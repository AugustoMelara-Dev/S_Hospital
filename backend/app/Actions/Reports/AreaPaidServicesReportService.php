<?php

declare(strict_types=1);

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\Area;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AreaPaidServicesReportService
{
    use FormatsReportMoney;

    /**
     * @return array<string, mixed>
     */
    public function report(Area $area, string $dateFrom, string $dateTo, int $page = 1, int $perPage = 50): array
    {
        $start = Carbon::createFromFormat('Y-m-d', $dateFrom)->startOfDay();
        $end = Carbon::createFromFormat('Y-m-d', $dateTo)->endOfDay();
        $page = max(1, $page);
        $perPage = min(100, max(1, $perPage));
        $offset = ($page - 1) * $perPage;

        $paidInvoices = DB::table('payments')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->groupBy('payments.invoice_id')
            ->select('payments.invoice_id')
            ->selectRaw('MAX(payments.paid_at) as paid_at')
            ->selectRaw('GROUP_CONCAT(DISTINCT payments.method) as methods');

        $baseQuery = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->joinSub($paidInvoices, 'paid_invoices', function ($join): void {
                $join->on('paid_invoices.invoice_id', '=', 'invoices.id');
            })
            ->where('invoices.status', Invoice::STATUS_PAID)
            ->where('invoice_items.area_id', $area->id);

        $total = (clone $baseQuery)->count();

        $services = $baseQuery
            ->orderByDesc('paid_invoices.paid_at')
            ->orderBy('invoices.invoice_number')
            ->orderBy('invoice_items.service_name')
            ->offset($offset)
            ->limit($perPage)
            ->select([
                'invoices.invoice_number',
                'invoices.patient_name',
                'invoices.issued_at',
                'invoice_items.service_name',
                'invoice_items.category_name',
                'invoice_items.area_name',
                'invoice_items.quantity_cents',
                'invoice_items.line_total_cents',
                'paid_invoices.paid_at',
                'paid_invoices.methods',
            ])
            ->get()
            ->map(fn (object $row): array => [
                'invoice_number' => $row->invoice_number,
                'patient_name' => $row->patient_name,
                'issued_at' => Carbon::parse($row->issued_at)->toIso8601String(),
                'paid_at' => Carbon::parse($row->paid_at)->toIso8601String(),
                'service_name' => $row->service_name,
                'category_name' => $row->category_name,
                'area_name' => $row->area_name ?? $area->name,
                'quantity' => $this->quantity((int) $row->quantity_cents),
                'amount' => $this->centsToMoney((int) $row->line_total_cents),
                'payment_methods' => $this->methods($row->methods),
            ])
            ->values()
            ->all();

        return [
            'area' => $area->name,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'services' => $services,
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
            ],
        ];
    }

    private function quantity(int $quantityCents): string
    {
        return number_format($quantityCents / 100, 2, '.', '');
    }

    /**
     * @return list<string>
     */
    private function methods(mixed $methods): array
    {
        if (! is_string($methods) || trim($methods) === '') {
            return [];
        }

        return array_values(array_filter(array_map('trim', explode(',', $methods))));
    }
}
