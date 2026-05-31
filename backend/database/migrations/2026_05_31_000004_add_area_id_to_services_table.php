<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->foreignId('area_id')
                ->nullable()
                ->after('category_id')
                ->constrained('areas')
                ->nullOnDelete();

            $table->index(['area_id', 'active']);
        });

        $now = now();
        $categories = DB::table('categories')
            ->select('id', 'name', 'slug', 'active')
            ->orderBy('id')
            ->get();

        foreach ($categories as $category) {
            DB::table('areas')->updateOrInsert(
                ['slug' => $category->slug],
                [
                    'name' => $category->name,
                    'active' => (bool) $category->active,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );

            $areaId = DB::table('areas')
                ->where('slug', $category->slug)
                ->value('id');

            DB::table('services')
                ->where('category_id', $category->id)
                ->whereNull('area_id')
                ->update(['area_id' => $areaId]);
        }
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->dropIndex(['area_id', 'active']);
            $table->dropConstrainedForeignId('area_id');
        });
    }
};
