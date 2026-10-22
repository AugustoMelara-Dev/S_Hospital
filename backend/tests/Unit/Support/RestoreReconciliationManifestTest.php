<?php

declare(strict_types=1);

namespace Tests\Unit\Support;

use App\Support\RestoreReconciliationManifest;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class RestoreReconciliationManifestTest extends TestCase
{
    /** @var list<string> */
    private array $tempFiles = [];

    protected function tearDown(): void
    {
        foreach ($this->tempFiles as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }

        parent::tearDown();
    }

    public function test_valid_manifest_parses_maxima_hash_and_backup_evidence(): void
    {
        [$path, $hash] = $this->manifestFile(maxInvoice: 1234, maxReceipt: 87);

        $manifest = RestoreReconciliationManifest::fromFile($path);

        $this->assertSame(1234, $manifest->maxInvoiceNumber());
        $this->assertSame(87, $manifest->maxReceiptNumber());
        $this->assertSame($hash, $manifest->hash());
        $this->assertSame(12, $manifest->backup()['id']);
        $this->assertSame('USB-HOSPITAL-1', $manifest->backup()['destination_label']);

        // La evidencia de auditoria no expone la ruta local del archivo.
        $evidence = $manifest->auditEvidence();
        $this->assertArrayNotHasKey('path', $evidence);
        $this->assertArrayNotHasKey('path', $evidence['backup']);
        $this->assertSame($hash, $evidence['hash']);
    }

    public function test_hash_is_verified_against_canonical_payload(): void
    {
        [$path] = $this->manifestFile();

        $decoded = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        $decoded['max_invoice_number'] = 999999;
        file_put_contents($path, json_encode($decoded, JSON_THROW_ON_ERROR));

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/hash/');
        RestoreReconciliationManifest::fromFile($path);
    }

    public function test_unknown_top_level_field_is_rejected(): void
    {
        [$path, $hash, $payload] = $this->manifestFile();
        $payload['campo_extra'] = true;

        $this->rewriteWithRecomputedHash($path, $payload);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/campos desconocidos/');
        RestoreReconciliationManifest::fromFile($path);
    }

    public function test_unknown_backup_field_is_rejected(): void
    {
        [$path, $hash, $payload] = $this->manifestFile();
        $payload['backup']['campo_extra'] = 'x';

        $this->rewriteWithRecomputedHash($path, $payload);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/campos desconocidos/');
        RestoreReconciliationManifest::fromFile($path);
    }

    public function test_unsupported_schema_version_is_rejected(): void
    {
        [$path, $hash, $payload] = $this->manifestFile();
        $payload['schema_version'] = 2;

        $this->rewriteWithRecomputedHash($path, $payload);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/schema_version/');
        RestoreReconciliationManifest::fromFile($path);
    }

    public function test_malformed_backup_sha256_is_rejected(): void
    {
        [$path, $hash, $payload] = $this->manifestFile();
        $payload['backup']['sha256'] = 'NO-ES-HEX';

        $this->rewriteWithRecomputedHash($path, $payload);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/sha256/');
        RestoreReconciliationManifest::fromFile($path);
    }

    public function test_non_iso_generated_at_is_rejected(): void
    {
        [$path, $hash, $payload] = $this->manifestFile();
        $payload['generated_at'] = '13/09/2026 20:00';

        $this->rewriteWithRecomputedHash($path, $payload);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/ISO-8601/');
        RestoreReconciliationManifest::fromFile($path);
    }

    public function test_negative_maxima_are_rejected(): void
    {
        [$path, $hash, $payload] = $this->manifestFile();
        $payload['max_receipt_number'] = -1;

        $this->rewriteWithRecomputedHash($path, $payload);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/max_receipt_number/');
        RestoreReconciliationManifest::fromFile($path);
    }

    public function test_relative_date_strings_are_rejected(): void
    {
        foreach (['now', '+1 day', 'next monday'] as $relative) {
            [$path, $hash, $payload] = $this->manifestFile();
            $payload['generated_at'] = $relative;

            $this->rewriteWithRecomputedHash($path, $payload);

            try {
                RestoreReconciliationManifest::fromFile($path);
                $this->fail("La fecha relativa '{$relative}' debio rechazarse.");
            } catch (RuntimeException $exception) {
                $this->assertStringContainsString('ISO-8601', $exception->getMessage());
            }
        }
    }

    public function test_date_only_and_space_separated_timestamps_are_rejected(): void
    {
        foreach (['2026-09-13', '2026-09-13 20:00:00', '2026-02-30T20:00:00Z', '2026-09-13T24:00:00Z'] as $invalid) {
            [$path, $hash, $payload] = $this->manifestFile();
            $payload['backup']['verified_at'] = $invalid;

            $this->rewriteWithRecomputedHash($path, $payload);

            try {
                RestoreReconciliationManifest::fromFile($path);
                $this->fail("La fecha '{$invalid}' debio rechazarse.");
            } catch (RuntimeException $exception) {
                $this->assertStringContainsString('ISO-8601', $exception->getMessage());
            }
        }
    }

    public function test_absolute_or_backslash_relative_paths_are_rejected(): void
    {
        foreach (['/etc/passwd', 'C:\\secrets\\backup.enc', '\\\\server\\share\\backup.enc', 'copies\\backup.enc', '../copies/backup.enc', "copies/bad\nname.enc"] as $invalid) {
            [$path, $hash, $payload] = $this->manifestFile();
            $payload['backup']['relative_path'] = $invalid;

            $this->rewriteWithRecomputedHash($path, $payload);

            try {
                RestoreReconciliationManifest::fromFile($path);
                $this->fail("La ruta '".addcslashes($invalid, "\n")."' debio rechazarse.");
            } catch (RuntimeException $exception) {
                $this->assertStringContainsString('relative_path', $exception->getMessage());
            }
        }
    }

    public function test_canonical_json_sorts_keys_recursively_and_deterministically(): void
    {
        $a = ['b' => 2, 'a' => ['d' => 4, 'c' => 3]];
        $b = ['a' => ['c' => 3, 'd' => 4], 'b' => 2];

        $this->assertSame('{"a":{"c":3,"d":4},"b":2}', RestoreReconciliationManifest::canonicalJson($a));
        $this->assertSame(
            RestoreReconciliationManifest::canonicalJson($a),
            RestoreReconciliationManifest::canonicalJson($b),
        );
    }

    /**
     * @return array{0: string, 1: string, 2: array<string, mixed>}
     */
    private function manifestFile(int $maxInvoice = 10, int $maxReceipt = 5): array
    {
        $payload = [
            'schema_version' => 1,
            'generated_at' => '2026-09-13T20:00:00Z',
            'backup' => [
                'id' => 12,
                'sha256' => hash('sha256', 'backup-bytes'),
                'verified_at' => '2026-09-13T19:59:00Z',
                'destination_label' => 'USB-HOSPITAL-1',
                'relative_path' => 'copies/backup-test.sql.enc',
                'external_copy_id' => 7,
                'bytes' => 1024,
            ],
            'max_invoice_number' => $maxInvoice,
            'max_receipt_number' => $maxReceipt,
        ];

        $hash = hash('sha256', $this->canonicalJson($payload));
        $payload['hash'] = $hash;
        $path = $this->writeJson($payload);

        return [$path, $hash, $payload];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function rewriteWithRecomputedHash(string $path, array $payload): void
    {
        unset($payload['hash']);
        $payload['hash'] = hash('sha256', $this->canonicalJson($payload));
        file_put_contents($path, json_encode($payload, JSON_THROW_ON_ERROR));
    }

    /**
     * Implementacion independiente del hash canonico para no validar el
     * parser con su propio codigo.
     *
     * @param  array<string, mixed>  $payload
     */
    private function canonicalJson(array $payload): string
    {
        $sort = static function (array &$value) use (&$sort): void {
            if (! array_is_list($value)) {
                ksort($value, SORT_STRING);
            }

            foreach ($value as &$child) {
                if (is_array($child)) {
                    $sort($child);
                }
            }
            unset($child);
        };

        $sort($payload);

        return json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function writeJson(array $payload): string
    {
        $path = tempnam(sys_get_temp_dir(), 't2037-manifest-');
        if ($path === false) {
            throw new RuntimeException('No se pudo crear el manifiesto temporal de prueba.');
        }

        file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $this->tempFiles[] = $path;

        return $path;
    }
}
