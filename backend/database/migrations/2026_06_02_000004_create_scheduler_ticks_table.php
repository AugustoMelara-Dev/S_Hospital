<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Records each tick of the Laravel scheduler. Used by
     * SystemStatusController to report the actual scheduler heartbeat
     * (the previous version just hard-coded the command string without
     * checking whether schedule:run was actually being invoked).
     */
    public function up(): void
    {
        if (Schema::hasTable('scheduler_ticks')) {
            return;
        }

        Schema::create('scheduler_ticks', function (Blueprint $table): void {
            $table->id();
            $table->timestamp('at')->index();
            $table->string('result', 16)->default('ok');
            $table->string('message', 255)->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['at', 'result'], 'scheduler_ticks_at_result_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scheduler_ticks');
    }
};
