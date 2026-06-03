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
        if (Schema::hasColumn('payments', 'amount_cents')) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) {
            $table->bigInteger('amount_cents')->after('amount')->nullable();
        });

        $driver = DB::connection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::table('payments')->whereNotNull('amount')->update([
                'amount_cents' => DB::raw('CAST(amount * 100 AS SIGNED)'),
            ]);
        } else {
            DB::table('payments')->whereNotNull('amount')->orderBy('id')->chunkById(500, function ($rows): void {
                foreach ($rows as $row) {
                    DB::table('payments')
                        ->where('id', $row->id)
                        ->update([
                            'amount_cents' => (int) round(((float) $row->amount) * 100),
                        ]);
                }
            });
        }

        Schema::table('payments', function (Blueprint $table) {
            $table->bigInteger('amount_cents')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('payments', 'amount_cents')) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('amount_cents');
        });
    }
};
