<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * F014 / T2-040: guard de deprecacion de `operation_idempotency_keys`.
 *
 * La tabla legacy ya no tiene escritores desde 2026-07-01 (el middleware
 * vigente usa `idempotency_keys`) y su modelo fue eliminado en 44538b7e. Este
 * test falla si aparece un nuevo consumidor de runtime, y fija la lista de
 * migraciones historicas que pueden mencionarla. Cualquier retiro (drop)
 * requiere copia verificada y autorizacion, fuera de esta campana.
 *
 * No usa base de datos: es un analizador de codigo portable.
 */
class OperationIdempotencyKeysLegacyConsumerGuardTest extends TestCase
{
    private const LEGACY_TABLE = 'operation_idempotency_keys';

    private const LEGACY_MODEL = 'OperationIdempotencyKey';

    public function test_runtime_code_only_touches_the_legacy_table_in_the_prune_command(): void
    {
        $offenders = $this->scan(['app', 'routes', 'bootstrap', 'config', 'database/seeders']);

        $this->assertSame(
            ['app/Console/Commands/PruneIdempotencyKeysCommand.php'],
            $offenders,
            "Solo PruneIdempotencyKeysCommand (poda por retencion) puede tocar la tabla legacy.\n".
            "Si este fallo es intencional, documente el nuevo consumidor y actualice este guard:\n".
            implode("\n", $offenders),
        );
    }

    public function test_only_known_historical_migrations_reference_the_legacy_table(): void
    {
        $expected = [
            'database/migrations/2026_05_31_000006_create_operation_idempotency_keys_table.php',
            'database/migrations/2026_06_15_000002_restrict_forensic_user_foreign_keys.php',
            'database/migrations/2026_07_16_000004_add_idempotency_prune_indexes.php',
            'database/migrations/2026_09_13_220002_mark_operation_idempotency_keys_deprecated.php',
        ];

        $found = $this->scan(['database/migrations'], basenameOnly: true);

        $this->assertSame(
            $expected,
            $found,
            "Una migracion nueva referencia la tabla legacy.\n".
            "El retiro es una fase destructiva con copia verificada y autorizacion; actualice el plan antes de tocar la tabla:\n".
            implode("\n", $found),
        );
    }

    /**
     * @param  list<string>  $directories  relativos a base_path()
     * @return list<string> rutas relativas normalizadas con '/'
     */
    private function scan(array $directories, bool $basenameOnly = false): array
    {
        $needles = [self::LEGACY_TABLE, self::LEGACY_MODEL];
        $matches = [];

        foreach ($directories as $directory) {
            foreach (File::allFiles(base_path($directory)) as $file) {
                if ($file->getExtension() !== 'php') {
                    continue;
                }

                $contents = file_get_contents($file->getPathname());

                if ($contents === false) {
                    continue;
                }

                foreach ($needles as $needle) {
                    if (str_contains($contents, $needle)) {
                        $matches[] = $basenameOnly
                            ? $directory.'/'.$file->getBasename()
                            : $directory.'/'.str_replace('\\', '/', $file->getRelativePathname());

                        break;
                    }
                }
            }
        }

        sort($matches);

        return $matches;
    }
}
