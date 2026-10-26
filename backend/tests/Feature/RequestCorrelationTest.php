<?php

namespace Tests\Feature;

use App\Actions\Backups\CreateBackupAction;
use App\Actions\Backups\DatabaseDumpWriter;
use App\Actions\Backups\EncryptBackupFileAction;
use App\Actions\Backups\PruneBackupsAction;
use App\Jobs\RunBackupJob;
use App\Models\ClientErrorLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class RequestCorrelationTest extends TestCase
{
    use RefreshDatabase;

    public function test_request_ids_are_generated_by_the_server_and_not_reused_between_requests(): void
    {
        Route::get('/api/_test/correlation', fn () => response()->json(['ok' => true]));
        $incoming = (string) Str::uuid();
        $first = $this->getJson('/api/_test/correlation', ['X-Request-ID' => $incoming])->assertOk();
        $second = $this->getJson('/api/_test/correlation')->assertOk();

        $this->assertTrue(Str::isUuid($first->headers->get('X-Request-ID')));
        $this->assertNotSame($incoming, $first->headers->get('X-Request-ID'));
        $this->assertNotSame($first->headers->get('X-Request-ID'), $second->headers->get('X-Request-ID'));
    }

    public function test_server_exception_has_the_same_reference_in_response_and_safe_server_diagnostics(): void
    {
        config(['app.debug' => false]);
        Log::spy();
        Route::get('/api/_test/correlation-error', function (): never {
            throw new RuntimeException('SQLSTATE[HY000] PASSWORD=private-credential TOKEN=private-token C:\\private\\config.env', 2026);
        });

        $response = $this->getJson('/api/_test/correlation-error?patient=PrivatePatient')->assertStatus(500);
        $id = $response->headers->get('X-Request-ID');
        $this->assertTrue(Str::isUuid($id));
        $response->assertJsonPath('request_id', $id)->assertJsonPath('code', 'SERVER_ERROR');
        foreach (['private-credential', 'private-token', 'C:\\private', 'PrivatePatient'] as $private) {
            $this->assertStringNotContainsString($private, $response->getContent());
        }

        Log::shouldHaveReceived('error')->with('server.exception', \Mockery::on(function (array $context) use ($id): bool {
            $serialized = json_encode($context, JSON_THROW_ON_ERROR);
            foreach (['private-credential', 'private-token', 'C:\\private', 'PrivatePatient', 'exception"'] as $private) {
                $this->assertStringNotContainsString($private, $serialized);
            }
            $this->assertSame($id, $context['request_id']);
            $this->assertSame('SERVER_ERROR', $context['diagnostic_code']);
            $this->assertSame(RuntimeException::class, $context['exception_type']);
            $this->assertNotEmpty($context['trace']);

            return true;
        }))->once();
        Log::shouldHaveReceived('error')->once();
    }

    public function test_failed_backup_records_safe_diagnostic_stage_and_request_reference(): void
    {
        Storage::fake('local');
        Log::spy();
        $id = (string) Str::uuid();
        request()->attributes->set('request_id', $id);
        $writer = new class extends DatabaseDumpWriter
        {
            public function dumpTo(string $absolutePath): void
            {
                throw new RuntimeException('Got error: 2026 SQLSTATE[HY000] DB_PASSWORD=$PRIVATE_CREDENTIAL TOKEN=$PRIVATE_TOKEN C:\\private\\config.env', 2026);
            }
        };

        $backup = (new CreateBackupAction($writer, app(EncryptBackupFileAction::class), app(PruneBackupsAction::class)))->execute();
        $this->assertSame('failed', $backup->status);
        $this->assertStringNotContainsString('private-credential', (string) $backup->error_message);
        Log::shouldHaveReceived('error')->with('backup.failed', \Mockery::on(function (array $context) use ($id, $backup): bool {
            $serialized = json_encode($context, JSON_THROW_ON_ERROR);
            foreach (['private-credential', 'private-token', 'C:\\private', 'SQLSTATE', '.php', 'exception"'] as $private) {
                $this->assertStringNotContainsString($private, $serialized);
            }
            $this->assertSame($id, $context['request_id']);
            $this->assertSame('BACKUP_FAILED', $context['diagnostic_code']);
            $this->assertSame('dump', $context['stage']);
            $this->assertSame($backup->id, $context['backup_id']);
            $this->assertSame('2026', $context['exception_code']);
            $this->assertSame('DATABASE_TLS_FAILED', $context['reason_code']);
            $this->assertNotEmpty($context['trace']);

            return true;
        }))->once();
    }

    public function test_unknown_server_exception_never_exposes_its_message_even_with_debug_enabled(): void
    {
        config(['app.debug' => true]);
        Route::get('/api/_test/private-exception', function (): never {
            throw new RuntimeException('private-value-without-a-label C:/private/config.env');
        });

        $response = $this->getJson('/api/_test/private-exception')->assertStatus(500);
        $response->assertJsonPath('code', 'SERVER_ERROR');
        $this->assertSame($response->headers->get('X-Request-ID'), $response->json('request_id'));
        $this->assertStringNotContainsString('private-value', $response->getContent());
        $this->assertStringNotContainsString('C:/private', $response->getContent());
        $response->assertJsonMissingPath('trace');
    }

    public function test_a_queued_backup_keeps_its_origin_request_id_after_serialization(): void
    {
        Storage::fake('local');
        Log::spy();
        $writer = new class extends DatabaseDumpWriter
        {
            public function dumpTo(string $absolutePath): void
            {
                throw new RuntimeException('Got error: 2026 SSL is required, but the server does not support it');
            }
        };
        $action = new CreateBackupAction($writer, app(EncryptBackupFileAction::class), app(PruneBackupsAction::class));
        $backup = $action->createPending();
        $origin = (string) Str::uuid();
        $job = unserialize(serialize(new RunBackupJob($backup->id, $origin)));
        request()->attributes->set('request_id', (string) Str::uuid());
        $job->handle($action);

        $this->assertSame('failed', $backup->fresh()->status);
        Log::shouldHaveReceived('error')->with('backup.failed', \Mockery::on(fn (array $context): bool => $context['request_id'] === $origin
            && $context['reason_code'] === 'DATABASE_TLS_FAILED'
            && $context['stage'] === 'dump'));
    }

    public function test_client_issue_preserves_origin_request_id_separately_from_ingestion_request_id(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('cajero');
        $origin = (string) Str::uuid();
        $response = $this->actingAs($user)->postJson('/api/system/client-errors', [
            'event_type' => 'api_error', 'severity' => 'error', 'safe_message' => 'Servidor no disponible.',
            'context' => ['request_id' => $origin, 'module' => 'backups'],
        ])->assertCreated();
        $this->assertSame($origin, ClientErrorLog::query()->firstOrFail()->context_json['request_id']);
        $this->assertTrue(Str::isUuid($response->headers->get('X-Request-ID')));
        $this->assertNotSame($origin, $response->headers->get('X-Request-ID'));
    }

    public function test_client_issue_drops_invalid_origin_request_id_without_storing_secrets(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('cajero');
        $this->actingAs($user)->postJson('/api/system/client-errors', [
            'event_type' => 'api_error', 'severity' => 'error', 'safe_message' => 'Servidor no disponible.',
            'context' => ['request_id' => 'TOKEN=private-token', 'module' => 'backups'],
        ])->assertCreated();
        $this->assertSame(['module' => 'backups'], ClientErrorLog::query()->firstOrFail()->context_json);
    }
}
