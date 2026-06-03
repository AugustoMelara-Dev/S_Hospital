<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->foreignId('area_id')
                ->nullable()
                ->after('category_name')
                ->constrained('areas')
                ->nullOnDelete();
            $table->string('area_name', 180)
                ->nullable()
                ->after('area_id');

            $table->index('area_id');
            $table->index('area_name', 'invoice_items_area_name_index');
        });

        $areasById = DB::table('areas')
            ->select('id', 'name', 'slug')
            ->get()
            ->keyBy('id');
        $areasBySlug = $areasById->keyBy('slug');
        $servicesById = DB::table('services')
            ->select('id', 'area_id')
            ->get()
            ->keyBy('id');
        $categoriesById = DB::table('categories')
            ->select('id', 'slug')
            ->get()
            ->keyBy('id');

        DB::table('invoice_items')
            ->select('id', 'service_id', 'category_id', 'category_name')
            ->orderBy('id')
            ->chunkById(500, function ($items) use ($areasById, $areasBySlug, $servicesById, $categoriesById): void {
                foreach ($items as $item) {
                    $areaId = null;
                    $areaName = null;
                    $service = $item->service_id ? $servicesById->get($item->service_id) : null;

                    if ($service?->area_id && $areasById->has($service->area_id)) {
                        $area = $areasById->get($service->area_id);
                        $areaId = $area->id;
                        $areaName = $area->name;
                    }

                    if ($areaName === null && $item->category_id && $categoriesById->has($item->category_id)) {
                        $category = $categoriesById->get($item->category_id);
                        $area = $areasBySlug->get($category->slug);
                        if ($area) {
                            $areaId = $area->id;
                            $areaName = $area->name;
                        }
                    }

                    DB::table('invoice_items')
                        ->where('id', $item->id)
                        ->update([
                            'area_id' => $areaId,
                            'area_name' => $areaName ?? $item->category_name ?? 'Sin area',
                        ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropIndex('invoice_items_area_name_index');
            $table->dropConstrainedForeignId('area_id');
            $table->dropColumn('area_name');
        });
    }
};
