<?php

namespace Tests\Unit;

use App\Support\Testing\MigrationHash;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class MigrationHashTest extends TestCase
{
    public function test_hash_is_stable_for_same_files_regardless_of_input_order(): void
    {
        $root = storage_path('framework/testing/migration-hash-stable');
        File::deleteDirectory($root);
        File::ensureDirectoryExists($root);

        $first = $root.'/2026_01_01_000001_create_alpha.php';
        $second = $root.'/2026_01_02_000002_create_beta.php';

        File::put($first, '<?php return "alpha";');
        File::put($second, '<?php return "beta";');

        $hashA = MigrationHash::fromFiles([$first, $second]);
        $hashB = MigrationHash::fromFiles([$second, $first]);

        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $hashA);
        $this->assertSame($hashA, $hashB);
    }

    public function test_hash_changes_when_file_content_changes(): void
    {
        $root = storage_path('framework/testing/migration-hash-content');
        File::deleteDirectory($root);
        File::ensureDirectoryExists($root);

        $file = $root.'/2026_01_01_000001_create_alpha.php';
        File::put($file, '<?php return "alpha";');

        $original = MigrationHash::fromFiles([$file]);

        File::put($file, '<?php return "alpha changed";');

        $this->assertNotSame($original, MigrationHash::fromFiles([$file]));
    }

    public function test_laravel_base_hash_includes_service_catalog_csv(): void
    {
        $root = storage_path('framework/testing/migration-hash-base');
        File::deleteDirectory($root);
        File::ensureDirectoryExists($root.'/database/migrations');
        File::ensureDirectoryExists($root.'/database/seeders/data');

        File::put($root.'/database/migrations/2026_01_01_000001_create_alpha.php', '<?php return "alpha";');
        File::put($root.'/database/seeders/DatabaseSeeder.php', '<?php return "database";');
        File::put($root.'/database/seeders/RolesAndPermissionsSeeder.php', '<?php return "roles";');
        File::put($root.'/database/seeders/ServiceCatalogSeeder.php', '<?php return "catalog";');
        File::put($root.'/database/seeders/data/catalogo_servicios_inicial.csv', "codigo,nombre\n001,Consulta\n");

        $original = MigrationHash::forLaravelBase($root);

        File::put($root.'/database/seeders/data/catalogo_servicios_inicial.csv', "codigo,nombre\n001,Consulta externa\n");

        $this->assertNotSame($original, MigrationHash::forLaravelBase($root));
    }

    public function test_laravel_base_hash_is_stable_across_checkout_paths(): void
    {
        $firstRoot = storage_path('framework/testing/migration-hash-checkout-a');
        $secondRoot = storage_path('framework/testing/migration-hash-checkout-b');
        File::deleteDirectory($firstRoot);
        File::deleteDirectory($secondRoot);

        foreach ([$firstRoot, $secondRoot] as $root) {
            File::ensureDirectoryExists($root.'/database/migrations');
            File::ensureDirectoryExists($root.'/database/seeders/data');
            File::put($root.'/database/migrations/2026_01_01_000001_create_alpha.php', '<?php return "alpha";');
            File::put($root.'/database/seeders/DatabaseSeeder.php', '<?php return "database";');
            File::put($root.'/database/seeders/ReceiptPrintProfileSeeder.php', '<?php return "print profiles";');
            File::put($root.'/database/seeders/data/catalogo_servicios_inicial.csv', "codigo,nombre\n001,Consulta\n");
        }

        $this->assertSame(
            MigrationHash::forLaravelBase($firstRoot),
            MigrationHash::forLaravelBase($secondRoot),
        );
    }

    public function test_laravel_base_hash_includes_any_recursive_seeder_file(): void
    {
        $root = storage_path('framework/testing/migration-hash-recursive-seeders');
        File::deleteDirectory($root);
        File::ensureDirectoryExists($root.'/database/migrations');
        File::ensureDirectoryExists($root.'/database/seeders/sub');

        File::put($root.'/database/migrations/2026_01_01_000001_create_alpha.php', '<?php return "alpha";');
        File::put($root.'/database/seeders/DatabaseSeeder.php', '<?php return "database";');
        File::put($root.'/database/seeders/sub/ExtraSeeder.php', '<?php return "extra";');

        $original = MigrationHash::forLaravelBase($root);

        File::put($root.'/database/seeders/sub/ExtraSeeder.php', '<?php return "extra changed";');

        $this->assertNotSame($original, MigrationHash::forLaravelBase($root));
    }
}
