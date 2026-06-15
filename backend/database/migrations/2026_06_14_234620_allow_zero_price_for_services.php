<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        try {
            DB::statement('ALTER TABLE services DROP CONSTRAINT services_price_positive');
        } catch (QueryException) {
            // Might not exist
        }

        try {
            DB::statement('ALTER TABLE services ADD CONSTRAINT services_price_nonneg CHECK (price >= 0)');
        } catch (QueryException $e) {
            // Tolerate if already exists
            if (! str_contains($e->getMessage(), 'already exists') && ! str_contains($e->getMessage(), 'Duplicate key name') && ! str_contains($e->getMessage(), '1826')) {
                throw $e;
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        try {
            DB::statement('ALTER TABLE services DROP CONSTRAINT services_price_nonneg');
        } catch (QueryException) {
        }

        try {
            DB::statement('ALTER TABLE services ADD CONSTRAINT services_price_positive CHECK (price > 0)');
        } catch (QueryException $e) {
            if (! str_contains($e->getMessage(), 'already exists') && ! str_contains($e->getMessage(), 'Duplicate key name') && ! str_contains($e->getMessage(), '1826')) {
                throw $e;
            }
        }
    }
};
