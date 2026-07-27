<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RestrictInvoiceItemsInvoiceDeleteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        if (DB::getDriverName() === 'sqlite') {
            $this->markTestSkipped('Migration does not run on SQLite.');
        }
    }

    public function test_rollback_does_not_cascade_delete_items()
    {
        $fkDefinition = DB::selectOne(
            "SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS "
            . "WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'invoice_items' AND CONSTRAINT_NAME = 'invoice_items_invoice_id_foreign'",
            [DB::connection()->getDatabaseName()]
        );

        $this->assertNotNull($fkDefinition, 'La FK invoice_items.invoice_id debe existir en MariaDB.');
        $this->assertSame(
            'RESTRICT',
            strtoupper((string) $fkDefinition->DELETE_RULE),
            'La FK debe ser RESTRICT para preservar snapshots historicos. '
                . 'AGENTS.md prohibe explicitamente cascade-delete por debajo de facturas emitidas.'
        );

        $migrationSource = file_get_contents(
            __DIR__ . '/../../database/migrations/2026_05_18_000002_restrict_invoice_items_invoice_delete.php'
        );
        $this->assertIsString($migrationSource, 'La migracion restrict_invoice_items debe existir.');

        $this->assertDoesNotMatchRegularExpression(
            '/->cascadeOnDelete\s*\(/',
            (string) $migrationSource,
            'El down() de la migracion nunca debe invocar ->cascadeOnDelete().'
        );
        $this->assertStringContainsString(
            '->restrictOnDelete()',
            (string) $migrationSource,
            'La migracion debe usar ->restrictOnDelete() en up() y down().'
        );
    }
}
