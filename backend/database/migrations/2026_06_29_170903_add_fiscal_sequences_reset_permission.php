<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    public function up(): void
    {
        Permission::query()->firstOrCreate([
            'name' => 'fiscal.sequences.reset',
            'guard_name' => 'web',
        ]);
    }

    public function down(): void
    {
        Permission::query()->where('name', 'fiscal.sequences.reset')->delete();
    }
};
