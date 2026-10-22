<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * H-15 backfill (additive, historical invoices untouched).
 *
 * Existing installations already have `fiscal_settings.default_tax_rate` and
 * `services.taxable`. This migration materialises the configured rate as a row
 * in `tax_rates` (only when no default exists yet) and points the taxable
 * services at it, so their totals stay exactly the same after the upgrade.
 *
 * `invoice_items.tax_rate` is deliberately NOT touched: it is the per-line
 * historical snapshot and must never be recomputed from the catalog.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tax_rates') || ! Schema::hasTable('services') || ! Schema::hasTable('fiscal_settings')) {
            return;
        }

        $settings = DB::table('fiscal_settings')->first();
        $raw = $settings === null ? null : ($settings->default_tax_rate ?? null);

        if (! is_int($raw) && ! is_float($raw) && ! (is_string($raw) && is_numeric($raw))) {
            return;
        }

        $percentage = number_format((float) $raw, 2, '.', '');

        if ((float) $percentage <= 0) {
            return;
        }

        $now = now();
        $existing = DB::table('tax_rates')
            ->where('percentage', $percentage)
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->first();

        if ($existing === null) {
            $rateId = (int) DB::table('tax_rates')->insertGetId([
                'name' => 'ISV '.rtrim(rtrim($percentage, '0'), '.').' %',
                'percentage' => $percentage,
                'active' => true,
                'is_default' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            // Never demote an administrator-selected default.
            if (! DB::table('tax_rates')->where('is_default', true)->exists()) {
                DB::table('tax_rates')->where('id', $rateId)->update(['is_default' => true]);
            }
        } else {
            $rateId = (int) $existing->id;
        }

        DB::table('services')
            ->where('taxable', true)
            ->whereNull('tax_rate_id')
            ->update([
                'tax_rate_id' => $rateId,
                'updated_at' => $now,
            ]);
    }

    public function down(): void
    {
        // No-op on purpose: undoing this migration would silently change the
        // tax treatment of live products and could re-open issued accounts.
    }
};
