<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\Invoice;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ServiceSalesReportService
{
    use FormatsReportMoney;

    public function report(string $dateFrom, string $dateTo): array
    {
        $start = Carbon::createFromFormat('Y-m-d', $dateFrom)->startOfDay();
        $end = Carbon::createFromFormat('Y-m-d', $dateTo)->endOfDay();

        $services = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('invoices.issued_at', [$start, $end])
            ->groupBy('invoice_items.service_name', 'invoice_items.category_name')
            ->orderByDesc('total_cents')
            ->orderBy('invoice_items.service_name')
            ->limit(15)
            ->select('invoice_items.service_name', 'invoice_items.category_name')
            ->selectRaw('COUNT(*) as item_count')
            ->selectRaw('COALESCE(SUM(ROUND(invoice_items.quantity * 100)), 0) as quantity_cents')
            ->selectRaw('COALESCE(SUM(ROUND(invoice_items.line_total * 100)), 0) as total_cents')
            ->get()
            ->map(fn (object $row): array => [
                'service' => $row->service_name,
                'category' => $row->category_name,
                'item_count' => (int) $row->item_count,
                'quantity' => $this->centsToMoney($row->quantity_cents),
                'total' => $this->centsToMoney($row->total_cents),
            ])
            ->values()
            ->all();

        return [
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'services' => $services,
        ];
    }
}
