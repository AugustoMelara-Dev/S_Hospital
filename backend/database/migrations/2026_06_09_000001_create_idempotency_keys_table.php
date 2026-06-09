<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Resilience audit finding R-01: support idempotent retries for
     * critical cash operations. A cashier whose browser drops the
     * response after the server commits a payment must not be charged
     * twice when the network or the cashier retries the request.
     *
     * The client supplies an `Idempotency-Key` header (or `idempotency_key`
     * field in the JSON body for non-header-aware clients). The middleware
     * `App\Http\Middleware\IdempotencyKey` looks up the key in this table
     * scoped to (user, route, key). On the first hit it inserts a row,
     * runs the request normally, and then stores the response status and
     * body so retries can be replayed verbatim without re-running the
     * payment action.
     */
    public function up(): void
    {
        if (Schema::hasTable('idempotency_keys')) {
            return;
        }

        Schema::create('idempotency_keys', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('route_signature', 191);
            $table->string('idempotency_key', 191);
            $table->string('request_fingerprint', 64);
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->longText('response_body')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'route_signature', 'idempotency_key'], 'idempotency_keys_unique');
            $table->index('completed_at', 'idempotency_keys_completed_at_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
    }
};
