<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $payload = [
            'name' => 'fiscal.sequences.reset',
            'guard_name' => 'web',
            'created_at' => $now,
            'updated_at' => $now,
        ];

        if (! DB::table('permissions')->where('name', $payload['name'])->where('guard_name', $payload['guard_name'])->exists()) {
            DB::table('permissions')->insert($payload);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('permissions')) {
            DB::table('permissions')->where('name', 'fiscal.sequences.reset')->delete();
        }
    }
};
