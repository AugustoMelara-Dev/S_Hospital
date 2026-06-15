<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();

        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            return;
        }

        $checks = [
            'institutional_receipts' => [
                'institutional_receipts_amount_cents_nonneg' => '(amount_cents IS NULL OR amount_cents >= 0)',
            ],
            'invoices' => [
                'invoices_status_valid' => "status IN ('issued','partial','paid','void')",
                'invoices_paid_amount_nonneg' => '(paid_amount >= 0)',
                'invoices_balance_due_nonneg' => '(balance_due >= 0)',
            ],
            'payments' => [
                'payments_status_valid' => "status IN ('active','void')",
                'payments_amount_nonneg' => '(amount_cents >= 0)',
            ],
            'cash_register_sessions' => [
                'cash_register_sessions_status_valid' => "status IN ('open','closed')",
            ],
            'cash_movements' => [
                'cash_movements_amount_nonzero' => '(amount_cents <> 0)',
                'cash_movements_type_valid' => "type IN ('opening','sale','withdrawal','adjustment','void')",
            ],
            'audit_logs' => [
                'audit_logs_result_valid' => "result IN ('success','failed')",
            ],
            'service_price_histories' => [
                'service_price_history_old_nonneg' => '(old_price_cents IS NULL OR old_price_cents >= 0)',
                'service_price_history_new_nonneg' => '(new_price_cents >= 0)',
            ],
            'fiscal_sequences' => [
                'fiscal_sequences_range_valid' => '(max_number IS NULL OR current_number <= max_number)',
            ],
            'services' => [
                'services_price_or_special' => '(price_cents > 0 OR special_rule_code IS NOT NULL)',
            ],
        ];

        foreach ($checks as $table => $constraints) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach ($constraints as $name => $expr) {
                $exists = collect(DB::select(
                    'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS '.
                    'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
                    [$table, $name]
                ))->isNotEmpty();

                if ($exists) {
                    continue;
                }

                DB::statement("ALTER TABLE `{$table}` ADD CONSTRAINT `{$name}` CHECK ({$expr})");
            }
        }

        if (Schema::hasTable('receipt_print_profiles') && Schema::hasColumn('receipt_print_profiles', 'is_global_default')) {
            $dupes = DB::select(
                'SELECT COUNT(*) AS c FROM receipt_print_profiles WHERE is_global_default = 1'
            );
            $hasDuplicates = ($dupes[0]->c ?? 0) > 1;

            if (! $hasDuplicates) {
                $idxExists = collect(DB::select(
                    'SELECT INDEX_NAME FROM information_schema.STATISTICS '.
                    'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
                    ['receipt_print_profiles', 'uniq_receipt_print_profiles_global_default']
                ))->isNotEmpty();

                if (! $idxExists) {
                    DB::statement(
                        'CREATE UNIQUE INDEX uniq_receipt_print_profiles_global_default '.
                        'ON receipt_print_profiles (is_global_default) '.
                        'WHERE is_global_default = 1'
                    );
                }
            }
        }
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();

        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            return;
        }

        $names = [
            'institutional_receipts_amount_cents_nonneg',
            'invoices_status_valid',
            'invoices_paid_amount_nonneg',
            'invoices_balance_due_nonneg',
            'payments_status_valid',
            'payments_amount_nonneg',
            'cash_register_sessions_status_valid',
            'cash_movements_amount_nonzero',
            'cash_movements_type_valid',
            'audit_logs_result_valid',
            'service_price_history_old_nonneg',
            'service_price_history_new_nonneg',
            'fiscal_sequences_range_valid',
            'services_price_or_special',
        ];

        foreach ($names as $name) {
            try {
                DB::statement("ALTER TABLE DROP CHECK `{$name}`");
            } catch (Throwable) {
            }
        }

        try {
            DB::statement('DROP INDEX uniq_receipt_print_profiles_global_default ON receipt_print_profiles');
        } catch (Throwable) {
        }
    }
};
