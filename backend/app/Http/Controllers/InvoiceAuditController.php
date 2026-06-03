<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Support\InvoiceAccess;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceAuditController extends Controller
{
    public function __construct(private readonly InvoiceAccess $invoiceAccess) {}

    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            throw new AuthorizationException('Sesion requerida.');
        }

        if (! $user->can('audit.view')) {
            throw new AuthorizationException('No tiene permiso para consultar la auditoria.');
        }

        if (! $this->invoiceAccess->canAccessAnyInvoice($user)) {
            if ($invoice->issued_by !== $user->id) {
                throw new AuthorizationException('No tiene permiso para ver esta factura.');
            }
        }

        $entries = AuditLog::query()
            ->with(['user:id,name,username'])
            ->where('entity_type', Invoice::class)
            ->where('entity_id', $invoice->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(function (AuditLog $entry): array {
                return [
                    'id' => $entry->id,
                    'action' => $entry->action,
                    'user' => $entry->user ? [
                        'id' => $entry->user->id,
                        'name' => $entry->user->name,
                        'username' => $entry->user->username,
                    ] : null,
                    'old_values' => $entry->old_values,
                    'new_values' => $entry->new_values,
                    'created_at' => $entry->created_at?->toIso8601String(),
                ];
            })
            ->all();

        return response()->json([
            'data' => [
                'invoice' => [
                    'id' => $invoice->id,
                    'invoice_number' => $invoice->invoice_number,
                    'status' => $invoice->status,
                ],
                'entries' => $entries,
            ],
        ]);
    }
}
