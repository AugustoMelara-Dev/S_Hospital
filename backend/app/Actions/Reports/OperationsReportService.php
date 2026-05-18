<?php

namespace App\Actions\Reports;

use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Carbon;

class OperationsReportService
{
    use Concerns\FormatsReportMoney;

    /**
     * @param  array{date_from: string, date_to: string, cash_session_id?: int, user_id?: int, category_id?: int, method?: string, status?: string}  $filters
     */
    public function report(array $filters, bool $includeBackups = true): array
    {
        $start = Carbon::createFromFormat('Y-m-d', $filters['date_from'])->startOfDay();
        $end = Carbon::createFromFormat('Y-m-d', $filters['date_to'])->endOfDay();

        $voidQuery = Invoice::query()
            ->with('voidedBy:id,name,username')
            ->where('status', Invoice::STATUS_VOID)
            ->whereBetween('voided_at', [$start, $end])
            ->when(! empty($filters['status']) && $filters['status'] !== Invoice::STATUS_VOID, function ($query): void {
                $query->whereRaw('1 = 0');
            })
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('voided_by', $filters['user_id']);
            })
            ->when(! empty($filters['cash_session_id']), function ($query) use ($filters): void {
                $query->where('cash_session_id', $filters['cash_session_id']);
            })
            ->when(! empty($filters['category_id']), function ($query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.category_id', $filters['category_id']);
                });
            })
            ->when(! empty($filters['method']), function ($query) use ($filters, $start, $end): void {
                $query->whereExists(function ($subquery) use ($filters, $start, $end): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('payments')
                        ->whereColumn('payments.invoice_id', 'invoices.id')
                        ->where('payments.status', Payment::STATUS_POSTED)
                        ->where('payments.method', $filters['method'])
                        ->whereBetween('payments.paid_at', [$start, $end]);
                });
            });

        $voidCount = (clone $voidQuery)->count();
        $voids = (clone $voidQuery)
            ->latest('voided_at')
            ->limit(25)
            ->get()
            ->map(fn (Invoice $invoice): array => [
                'invoice_id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'patient_name' => $invoice->patient_name,
                'total' => (string) $invoice->total,
                'reason' => $invoice->void_reason,
                'voided_at' => $invoice->voided_at?->toISOString(),
                'user' => $invoice->voidedBy?->name,
            ])
            ->values()
            ->all();

        $reprintQuery = AuditLog::query()
            ->with('user:id,name,username')
            ->where('action', 'invoice.reprinted')
            ->where('entity_type', Invoice::class)
            ->whereBetween('created_at', [$start, $end])
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('user_id', $filters['user_id']);
            })
            ->when($this->hasInvoiceFilters($filters), function ($query) use ($filters, $start, $end): void {
                $query->whereExists(function ($subquery) use ($filters, $start, $end): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoices')
                        ->whereColumn('invoices.id', 'audit_logs.entity_id')
                        ->when(! empty($filters['status']), function ($invoiceQuery) use ($filters): void {
                            $invoiceQuery->where('invoices.status', $filters['status']);
                        })
                        ->when(! empty($filters['cash_session_id']), function ($invoiceQuery) use ($filters): void {
                            $invoiceQuery->where('invoices.cash_session_id', $filters['cash_session_id']);
                        })
                        ->when(! empty($filters['category_id']), function ($invoiceQuery) use ($filters): void {
                            $invoiceQuery->whereExists(function ($itemQuery) use ($filters): void {
                                $itemQuery
                                    ->selectRaw('1')
                                    ->from('invoice_items')
                                    ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                                    ->where('invoice_items.category_id', $filters['category_id']);
                            });
                        })
                        ->when(! empty($filters['method']), function ($invoiceQuery) use ($filters, $start, $end): void {
                            $invoiceQuery->whereExists(function ($paymentQuery) use ($filters, $start, $end): void {
                                $paymentQuery
                                    ->selectRaw('1')
                                    ->from('payments')
                                    ->whereColumn('payments.invoice_id', 'invoices.id')
                                    ->where('payments.status', Payment::STATUS_POSTED)
                                    ->where('payments.method', $filters['method'])
                                    ->whereBetween('payments.paid_at', [$start, $end]);
                            });
                        });
                });
            });

        $reprintCount = (clone $reprintQuery)->count();
        $reprints = (clone $reprintQuery)
            ->latest('created_at')
            ->limit(25)
            ->get()
            ->map(function (AuditLog $audit): array {
                $values = $audit->new_values ?? [];

                return [
                    'invoice_id' => $audit->entity_id,
                    'invoice_number' => $values['invoice_number'] ?? null,
                    'width' => $values['width'] ?? null,
                    'reason' => $values['reason'] ?? null,
                    'created_at' => $audit->created_at?->toISOString(),
                    'user' => $audit->user?->name,
                ];
            })
            ->values()
            ->all();

        $backupCount = 0;
        $failedBackupCount = 0;
        $backups = [];

        if ($includeBackups) {
            $backupQuery = BackupLog::query()
                ->with('creator:id,name,username')
                ->whereBetween('created_at', [$start, $end])
                ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                    $query->where('created_by', $filters['user_id']);
                });

            $backupCount = (clone $backupQuery)->count();
            $failedBackupCount = (clone $backupQuery)->where('status', BackupLog::STATUS_FAILED)->count();
            $backups = (clone $backupQuery)
                ->latest('created_at')
                ->limit(25)
                ->get()
                ->map(fn (BackupLog $backup): array => [
                    'id' => $backup->id,
                    'filename' => $backup->filename,
                    'status' => $backup->status,
                    'type' => $backup->type,
                    'size_bytes' => $backup->size_bytes,
                    'checksum_sha256' => $backup->checksum_sha256,
                    'created_at' => $backup->created_at?->toISOString(),
                    'completed_at' => $backup->completed_at?->toISOString(),
                    'creator' => $backup->creator?->name,
                ])
                ->values()
                ->all();
        }

        $collectedExpression = ! empty($filters['category_id'])
            ? 'COALESCE(SUM(ROUND(payments.amount * 100 * (
                SELECT COALESCE(SUM(invoice_items.line_total), 0)
                FROM invoice_items
                WHERE invoice_items.invoice_id = invoices.id
                AND invoice_items.category_id = ?
            ) / NULLIF(invoices.total, 0))), 0) as collected_cents'
            : 'COALESCE(SUM(ROUND(payments.amount * 100)), 0) as collected_cents';
        $collectedBindings = ! empty($filters['category_id']) ? [$filters['category_id']] : [];

        $cashiers = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->join('users', 'payments.user_id', '=', 'users.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->when(! empty($filters['status']) && $filters['status'] !== Invoice::STATUS_VOID, function ($query) use ($filters): void {
                $query->where('invoices.status', $filters['status']);
            })
            ->when(($filters['status'] ?? null) === Invoice::STATUS_VOID, function ($query): void {
                $query->whereRaw('1 = 0');
            })
            ->whereBetween('payments.paid_at', [$start, $end])
            ->when(! empty($filters['cash_session_id']), function ($query) use ($filters): void {
                $query->where('payments.cash_session_id', $filters['cash_session_id']);
            })
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('payments.user_id', $filters['user_id']);
            })
            ->when(! empty($filters['method']), function ($query) use ($filters): void {
                $query->where('payments.method', $filters['method']);
            })
            ->when(! empty($filters['category_id']), function ($query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.category_id', $filters['category_id']);
                });
            })
            ->groupBy('payments.user_id', 'users.name', 'users.username')
            ->orderByDesc('collected_cents')
            ->select('payments.user_id', 'users.name', 'users.username')
            ->selectRaw('COUNT(*) as payment_count')
            ->selectRaw('COUNT(DISTINCT payments.cash_session_id) as cash_session_count')
            ->selectRaw('COUNT(DISTINCT payments.invoice_id) as invoice_count')
            ->selectRaw($collectedExpression, $collectedBindings)
            ->get()
            ->map(fn (object $row): array => [
                'user_id' => (int) $row->user_id,
                'name' => $row->name,
                'username' => $row->username,
                'payment_count' => (int) $row->payment_count,
                'cash_session_count' => (int) $row->cash_session_count,
                'invoice_count' => (int) $row->invoice_count,
                'total_collected' => $this->centsToMoney($row->collected_cents),
            ])
            ->values()
            ->all();

        return [
            'date_from' => $filters['date_from'],
            'date_to' => $filters['date_to'],
            'filters' => [
                'cash_session_id' => $filters['cash_session_id'] ?? null,
                'user_id' => $filters['user_id'] ?? null,
                'category_id' => $filters['category_id'] ?? null,
                'method' => $filters['method'] ?? null,
                'status' => $filters['status'] ?? null,
            ],
            'summary' => [
                'void_count' => $voidCount,
                'reprint_count' => $reprintCount,
                'backup_count' => $backupCount,
                'failed_backup_count' => $failedBackupCount,
                'cashier_count' => count($cashiers),
            ],
            'voids' => $voids,
            'reprints' => $reprints,
            'backups' => $backups,
            'cashiers' => $cashiers,
        ];
    }

    /**
     * @param  array{cash_session_id?: int, category_id?: int, method?: string, status?: string}  $filters
     */
    private function hasInvoiceFilters(array $filters): bool
    {
        return ! empty($filters['cash_session_id'])
            || ! empty($filters['category_id'])
            || ! empty($filters['method'])
            || ! empty($filters['status']);
    }
}
