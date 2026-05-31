<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if ($this->indexExists('services_category_id_slug_unique')) {
            Schema::table('services', function (Blueprint $table) {
                $table->dropUnique('services_category_id_slug_unique');
            });
        }

        if (! $this->indexExists('services_category_area_slug_unique')) {
            Schema::table('services', function (Blueprint $table) {
                $table->unique(['category_id', 'area_id', 'slug'], 'services_category_area_slug_unique');
            });
        }
    }

    public function down(): void
    {
        if ($this->indexExists('services_category_area_slug_unique')) {
            Schema::table('services', function (Blueprint $table) {
                $table->dropUnique('services_category_area_slug_unique');
            });
        }

        if (! $this->indexExists('services_category_id_slug_unique')) {
            Schema::table('services', function (Blueprint $table) {
                $table->unique(['category_id', 'slug'], 'services_category_id_slug_unique');
            });
        }
    }

    private function indexExists(string $indexName): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            return collect(DB::select("PRAGMA index_list('services')"))
                ->contains(fn (object $index): bool => ($index->name ?? null) === $indexName);
        }

        return collect(DB::select('show index from services'))
            ->contains(fn (object $index): bool => ($index->Key_name ?? null) === $indexName);
    }
};
