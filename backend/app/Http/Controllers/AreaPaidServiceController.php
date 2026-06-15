<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AreaPaidServiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->can('area_services.view') || abort(403);
        $serviceAreaId = $user->getAttribute('service_area_id');

        abort_unless($serviceAreaId !== null, 403);

        $serviceAreaSlug = DB::table('service_areas')
            ->where('id', $serviceAreaId)
            ->value('slug');
        $catalogAreaId = $serviceAreaSlug === null
            ? null
            : DB::table('areas')->where('slug', $serviceAreaSlug)->value('id');

        $latestPayments = DB::table('payments')
            ->select('invoice_id', DB::raw('MAX(paid_at) as paid_at'))
            ->where('status', Payment::STATUS_POSTED)
            ->groupBy('invoice_id');

        $items = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->leftJoinSub($latestPayments, 'latest_payments', function ($join): void {
                $join->on('latest_payments.invoice_id', '=', 'invoices.id');
            })
            ->where(function ($query) use ($serviceAreaId, $catalogAreaId): void {
                $query->where('invoice_items.service_area_id', $serviceAreaId);

                if ($catalogAreaId !== null) {
                    $query->orWhere('invoice_items.area_id', $catalogAreaId);
                }
            })
            ->whereIn('invoices.status', [Invoice::STATUS_PAID, Invoice::STATUS_PARTIAL])
            ->orderByDesc('invoices.issued_at')
            ->limit(100)
            ->get([
                'invoice_items.id',
                'invoice_items.invoice_id',
                'invoice_items.service_name',
                'invoice_items.service_area_id',
                'invoice_items.service_area_name',
                'invoice_items.area_id',
                'invoice_items.area_name',
                'invoice_items.quantity',
                'invoice_items.line_total',
                'invoice_items.notes',
                'invoices.invoice_number',
                'invoices.patient_name',
                'invoices.status as payment_status',
                'invoices.issued_at',
                'latest_payments.paid_at',
            ])
            ->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'invoice_id' => (int) $row->invoice_id,
                'invoice_number' => $row->invoice_number,
                'issued_at' => $row->issued_at,
                'paid_at' => $row->paid_at,
                'patient_name' => $row->patient_name,
                'service_name' => $row->service_name,
                'service_area_id' => $row->service_area_id !== null ? (int) $row->service_area_id : ($row->area_id !== null ? (int) $row->area_id : null),
                'service_area_name' => $row->service_area_name ?? $row->area_name,
                'quantity' => $row->quantity,
                'line_total' => $row->line_total,
                'payment_status' => $row->payment_status,
                'administrative_note' => $row->notes,
            ])
            ->values();

        return response()->json(['data' => $items]);
    }
}
