<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\Invoice;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CategoryReportService
{
    use FormatsReportMoney;

    public function report(string $dateFrom, string $dateTo): array
    {
        $start = Carbon::createFromFormat('Y-m-d', $dateFrom)->startOfDay();
        $end = Carbon::createFromFormat('Y-m-d', $dateTo)->endOfDay();

        $rows = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('invoices.issued_at', [$start, $end])
            ->groupBy('invoice_items.category_name')
            ->orderBy('invoice_items.category_name')
            ->select('invoice_items.category_name')
            ->selectRaw('COUNT(*) as item_count')
            ->selectRaw('COALESCE(SUM(CAST(ROUND(invoice_items.quantity * 100) AS INTEGER)), 0) as quantity_cents')
            ->selectRaw('COALESCE(SUM(CAST(ROUND(invoice_items.line_subtotal * 100) AS INTEGER)), 0) as subtotal_cents')
            ->selectRaw('COALESCE(SUM(CAST(ROUND(invoice_items.tax_amount * 100) AS INTEGER)), 0) as tax_cents')
            ->selectRaw('COALESCE(SUM(CAST(ROUND(invoice_items.line_total * 100) AS INTEGER)), 0) as total_cents')
            ->get()
            ->map(fn (object $row): array => [
                'category' => $row->category_name,
                'item_count' => (int) $row->item_count,
                'quantity' => $this->centsToMoney($row->quantity_cents),
                'subtotal' => $this->centsToMoney($row->subtotal_cents),
                'tax_amount' => $this->centsToMoney($row->tax_cents),
                'total' => $this->centsToMoney($row->total_cents),
            ])
            ->values()
            ->all();

        return [
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'categories' => $rows,
        ];
    }
}
