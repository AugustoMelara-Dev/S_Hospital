<?php

declare(strict_types=1);

namespace Tests\Unit\Backups;

use App\Actions\Backups\BackupRecoveryKitService;
use Illuminate\Support\Facades\Config;
use RuntimeException;
use Tests\TestCase;

class BackupRecoveryKitServiceTest extends TestCase
{
    public function test_it_roundtrips_required_keys_without_exposing_them_in_the_kit(): void
    {
        Config::set('backups.encryption.key', 'base64:'.base64_encode(random_bytes(32)));
        Config::set('app.key', 'base64:'.base64_encode(random_bytes(32)));
        $backupKey = (string) Config::get('backups.encryption.key');
        $appKey = (string) Config::get('app.key');

        $kit = app(BackupRecoveryKitService::class)->create('Institutional passphrase 2026!');
        $encoded = json_encode($kit, JSON_THROW_ON_ERROR);

        $this->assertStringNotContainsString($backupKey, $encoded);
        $this->assertStringNotContainsString($appKey, $encoded);
        $this->assertSame('argon2id13', $kit['kdf']['algorithm']);
        $this->assertSame('aes-256-gcm', $kit['cipher']);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $kit['key_identifier']);
        $this->assertSame([
            'backup_encryption_key' => $backupKey,
            'app_key' => $appKey,
        ], app(BackupRecoveryKitService::class)->open($encoded, 'Institutional passphrase 2026!'));
    }

    public function test_wrong_passphrase_and_corrupt_kit_return_the_same_generic_error(): void
    {
        Config::set('backups.encryption.key', 'base64:'.base64_encode(random_bytes(32)));
        Config::set('app.key', 'base64:'.base64_encode(random_bytes(32)));
        $service = app(BackupRecoveryKitService::class);
        $encoded = json_encode($service->create('Correct institutional passphrase!'), JSON_THROW_ON_ERROR);

        foreach ([
            fn () => $service->open($encoded, 'Wrong institutional passphrase!'),
            fn () => $service->open(substr($encoded, 0, -12).'corrupt}', 'Correct institutional passphrase!'),
        ] as $attempt) {
            try {
                $attempt();
                $this->fail('El kit invalido no debe abrirse.');
            } catch (RuntimeException $exception) {
                $this->assertSame(BackupRecoveryKitService::GENERIC_OPEN_ERROR, $exception->getMessage());
            }
        }
    }

    public function test_it_rejects_oversized_input_and_modified_kdf_parameters(): void
    {
        Config::set('backups.encryption.key', 'base64:'.base64_encode(random_bytes(32)));
        Config::set('app.key', 'base64:'.base64_encode(random_bytes(32)));
        $service = app(BackupRecoveryKitService::class);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage(BackupRecoveryKitService::GENERIC_OPEN_ERROR);
        $service->open(str_repeat('x', BackupRecoveryKitService::MAX_KIT_BYTES + 1), 'Institutional passphrase 2026!');
    }

    public function test_modified_kdf_cost_is_rejected_before_derivation(): void
    {
        Config::set('backups.encryption.key', 'base64:'.base64_encode(random_bytes(32)));
        Config::set('app.key', 'base64:'.base64_encode(random_bytes(32)));
        $service = app(BackupRecoveryKitService::class);
        $kit = $service->create('Institutional passphrase 2026!');
        $kit['kdf']['memory_limit'] = PHP_INT_MAX;

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage(BackupRecoveryKitService::GENERIC_OPEN_ERROR);
        $service->open(json_encode($kit, JSON_THROW_ON_ERROR), 'Institutional passphrase 2026!');
    }

    public function test_modified_key_identifier_is_rejected_as_a_corrupt_kit(): void
    {
        Config::set('backups.encryption.key', 'base64:'.base64_encode(random_bytes(32)));
        Config::set('app.key', 'base64:'.base64_encode(random_bytes(32)));
        $service = app(BackupRecoveryKitService::class);
        $kit = $service->create('Institutional passphrase 2026!');
        $kit['key_identifier'] = str_repeat('0', 64);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage(BackupRecoveryKitService::GENERIC_OPEN_ERROR);
        $service->open(json_encode($kit, JSON_THROW_ON_ERROR), 'Institutional passphrase 2026!');
    }
}
