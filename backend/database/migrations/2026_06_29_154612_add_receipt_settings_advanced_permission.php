<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    public function up(): void
    {
        Permission::query()->firstOrCreate([
            'name' => 'receipt_settings.advanced',
            'guard_name' => 'web',
        ]);
    }

    public function down(): void
    {
        Permission::query()->where('name', 'receipt_settings.advanced')->delete();
    }
};
