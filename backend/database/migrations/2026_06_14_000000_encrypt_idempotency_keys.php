<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;

return new class extends Migration
{
    public function up(): void
    {
        Artisan::call('idempotency:encrypt-legacy');
    }

    public function down(): void
    {
        // One-way migration
    }
};
