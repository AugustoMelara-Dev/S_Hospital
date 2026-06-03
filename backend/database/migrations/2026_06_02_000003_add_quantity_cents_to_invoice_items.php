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
        if (Schema::hasColumn('invoice_items', 'quantity_cents')) {
            return;
        }

        Schema::table('invoice_items', function (Blueprint $table): void {
            $table->bigInteger('quantity_cents')->after('quantity')->nullable();
        });

        $driver = DB::connection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::table('invoice_items')->whereNotNull('quantity')->update([
                'quantity_cents' => DB::raw('CAST(quantity * 100 AS SIGNED)'),
            ]);
        } else {
            DB::table('invoice_items')
                ->whereNotNull('quantity')
                ->orderBy('id')
                ->chunkById(500, function ($rows): void {
                    foreach ($rows as $row) {
                        DB::table('invoice_items')
                            ->where('id', $row->id)
                            ->update([
                                'quantity_cents' => (int) round(((float) $row->quantity) * 100),
                            ]);
                    }
                });
        }

        Schema::table('invoice_items', function (Blueprint $table): void {
            $table->bigInteger('quantity_cents')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('invoice_items', 'quantity_cents')) {
            return;
        }

        Schema::table('invoice_items', function (Blueprint $table): void {
            $table->dropColumn('quantity_cents');
        });
    }
};
