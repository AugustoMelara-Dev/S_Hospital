<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addInvoiceCentsColumns();
        $this->addInvoiceItemCentsColumns();
    }

    public function down(): void
    {
        if (Schema::hasColumn('invoices', 'balance_due_cents')) {
            Schema::table('invoices', function (Blueprint $table): void {
                $table->dropColumn([
                    'subtotal_cents',
                    'tax_amount_cents',
                    'discount_amount_cents',
                    'total_cents',
                    'paid_amount_cents',
                    'balance_due_cents',
                ]);
            });
        }

        if (Schema::hasColumn('invoice_items', 'line_total_cents')) {
            Schema::table('invoice_items', function (Blueprint $table): void {
                $table->dropColumn([
                    'unit_price_cents',
                    'tax_amount_cents',
                    'line_subtotal_cents',
                    'line_total_cents',
                ]);
            });
        }
    }

    private function addInvoiceCentsColumns(): void
    {
        if (Schema::hasColumn('invoices', 'balance_due_cents')) {
            return;
        }

        Schema::table('invoices', function (Blueprint $table): void {
            $table->bigInteger('subtotal_cents')->after('subtotal')->nullable();
            $table->bigInteger('tax_amount_cents')->after('tax_amount')->nullable();
            $table->bigInteger('discount_amount_cents')->after('discount_amount')->nullable();
            $table->bigInteger('total_cents')->after('total')->nullable();
            $table->bigInteger('paid_amount_cents')->after('paid_amount')->nullable();
            $table->bigInteger('balance_due_cents')->after('balance_due')->nullable();
        });

        $this->backfillDecimalColumn('invoices', 'subtotal', 'subtotal_cents');
        $this->backfillDecimalColumn('invoices', 'tax_amount', 'tax_amount_cents');
        $this->backfillDecimalColumn('invoices', 'discount_amount', 'discount_amount_cents');
        $this->backfillDecimalColumn('invoices', 'total', 'total_cents');
        $this->backfillDecimalColumn('invoices', 'paid_amount', 'paid_amount_cents');
        $this->backfillDecimalColumn('invoices', 'balance_due', 'balance_due_cents');

        Schema::table('invoices', function (Blueprint $table): void {
            $table->bigInteger('subtotal_cents')->nullable(false)->change();
            $table->bigInteger('tax_amount_cents')->nullable(false)->change();
            $table->bigInteger('discount_amount_cents')->nullable(false)->change();
            $table->bigInteger('total_cents')->nullable(false)->change();
            $table->bigInteger('paid_amount_cents')->nullable(false)->change();
            $table->bigInteger('balance_due_cents')->nullable(false)->change();
        });
    }

    private function addInvoiceItemCentsColumns(): void
    {
        if (Schema::hasColumn('invoice_items', 'line_total_cents')) {
            return;
        }

        Schema::table('invoice_items', function (Blueprint $table): void {
            $table->bigInteger('unit_price_cents')->after('unit_price')->nullable();
            $table->bigInteger('tax_amount_cents')->after('tax_amount')->nullable();
            $table->bigInteger('line_subtotal_cents')->after('line_subtotal')->nullable();
            $table->bigInteger('line_total_cents')->after('line_total')->nullable();
        });

        $this->backfillDecimalColumn('invoice_items', 'unit_price', 'unit_price_cents');
        $this->backfillDecimalColumn('invoice_items', 'tax_amount', 'tax_amount_cents');
        $this->backfillDecimalColumn('invoice_items', 'line_subtotal', 'line_subtotal_cents');
        $this->backfillDecimalColumn('invoice_items', 'line_total', 'line_total_cents');

        Schema::table('invoice_items', function (Blueprint $table): void {
            $table->bigInteger('unit_price_cents')->nullable(false)->change();
            $table->bigInteger('tax_amount_cents')->nullable(false)->change();
            $table->bigInteger('line_subtotal_cents')->nullable(false)->change();
            $table->bigInteger('line_total_cents')->nullable(false)->change();
        });
    }

    private function backfillDecimalColumn(string $table, string $sourceColumn, string $targetColumn): void
    {
        $driver = DB::connection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::table($table)->whereNotNull($sourceColumn)->update([
                $targetColumn => DB::raw("CAST({$sourceColumn} * 100 AS SIGNED)"),
            ]);

            return;
        }

        DB::table($table)
            ->whereNotNull($sourceColumn)
            ->orderBy('id')
            ->chunkById(500, function ($rows) use ($table, $sourceColumn, $targetColumn): void {
                foreach ($rows as $row) {
                    DB::table($table)
                        ->where('id', $row->id)
                        ->update([
                            $targetColumn => (int) round(((float) $row->{$sourceColumn}) * 100),
                        ]);
                }
            });
    }
};
