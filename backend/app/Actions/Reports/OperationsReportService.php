<?php

declare(strict_types=1);

namespace App\Actions\Reports;

use App\Models\Area;
use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\Category;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class OperationsReportService
{
    use Concerns\FormatsReportMoney;

    /**
     * @param  array{date_from: string, date_to: string, cash_session_id?: int, user_id?: int, category_id?: int, area_id?: int, method?: string, status?: string}  $filters
     * @return array<string, mixed>
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
            ->when(! empty($filters['area_id']), function ($query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.area_id', $filters['area_id']);
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
                        ->when(! empty($filters['area_id']), function ($invoiceQuery) use ($filters): void {
                            $invoiceQuery->whereExists(function ($itemQuery) use ($filters): void {
                                $itemQuery
                                    ->selectRaw('1')
                                    ->from('invoice_items')
                                    ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                                    ->where('invoice_items.area_id', $filters['area_id']);
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
                    'invoice_number' => $values['invoice_number'] ?? null,
                    'width' => $values['width'] ?? null,
                    'reason' => $values['reason'] ?? null,
                    'created_at' => $audit->created_at?->toISOString(),
                    'user' => $audit->user?->name,
                ];
            })
            ->values()
            ->all();

        $serviceChangeQuery = AuditLog::query()
            ->with('user:id,name,username')
            ->where('entity_type', Service::class)
            ->where('action', 'like', 'service.%')
            ->whereBetween('created_at', [$start, $end])
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('user_id', $filters['user_id']);
            });

        $serviceChangeCount = (clone $serviceChangeQuery)->count();
        $serviceChangeRows = (clone $serviceChangeQuery)
            ->latest('created_at')
            ->limit(25)
            ->get();
        $categoryNames = $this->categoryNamesFor($serviceChangeRows);
        $areaNames = $this->areaNamesFor($serviceChangeRows);
        $catalogChanges = $serviceChangeRows
            ->map(fn (AuditLog $audit): array => [
                'action' => $audit->action,
                'service' => $audit->new_values['name'] ?? $audit->old_values['name'] ?? 'Servicio sin nombre',
                'old_values' => $this->safeServiceValues($audit->old_values, $categoryNames, $areaNames),
                'new_values' => $this->safeServiceValues($audit->new_values, $categoryNames, $areaNames),
                'created_at' => $audit->created_at?->toISOString(),
                'user' => $audit->user?->name,
            ])
            ->values()
            ->all();

        $paymentVoidQuery = Payment::query()
            ->with(['invoice:id,invoice_number,patient_name', 'voidedBy:id,name,username', 'user:id,name,username'])
            ->where('payments.status', Payment::STATUS_VOID)
            ->whereBetween('payments.voided_at', [$start, $end])
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('payments.voided_by', $filters['user_id']);
            })
            ->when(! empty($filters['cash_session_id']), function ($query) use ($filters): void {
                $query->where('payments.cash_session_id', $filters['cash_session_id']);
            })
            ->when(! empty($filters['method']), function ($query) use ($filters): void {
                $query->where('payments.method', $filters['method']);
            })
            ->when($this->hasInvoiceFilters($filters), function ($query) use ($filters): void {
                $query->whereHas('invoice', function ($invoiceQuery) use ($filters): void {
                    $invoiceQuery
                        ->when(! empty($filters['status']), function ($query) use ($filters): void {
                            $query->where('status', $filters['status']);
                        })
                        ->when(! empty($filters['category_id']), function ($query) use ($filters): void {
                            $query->whereHas('items', function ($itemQuery) use ($filters): void {
                                $itemQuery->where('category_id', $filters['category_id']);
                            });
                        })
                        ->when(! empty($filters['area_id']), function ($query) use ($filters): void {
                            $query->whereHas('items', function ($itemQuery) use ($filters): void {
                                $itemQuery->where('area_id', $filters['area_id']);
                            });
                        });
                });
            });

        $paymentVoidCount = (clone $paymentVoidQuery)->count();
        $paymentVoids = (clone $paymentVoidQuery)
            ->latest('payments.voided_at')
            ->limit(25)
            ->get()
            ->map(fn (Payment $payment): array => [
                'invoice_number' => $payment->invoice?->invoice_number,
                'patient_name' => $payment->invoice?->patient_name,
                'method' => $payment->method,
                'amount' => $this->centsToMoney((int) $payment->amount_cents),
                'reason' => $payment->void_reason,
                'voided_at' => $payment->voided_at?->toISOString(),
                'voided_by' => $payment->voidedBy?->name,
                'cashier' => $payment->user?->name,
            ])
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
                    'filename' => $backup->filename,
                    'status' => $backup->status,
                    'type' => $backup->type,
                    'size_bytes' => $backup->size_bytes,
                    'created_at' => $backup->created_at?->toISOString(),
                    'completed_at' => $backup->completed_at?->toISOString(),
                    'creator' => $backup->creator?->name,
                ])
                ->values()
                ->all();
        }

        $paymentsData = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
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
            ->when(! empty($filters['area_id']), function ($query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.area_id', $filters['area_id']);
                });
            })
            ->select('payments.*')
            ->with(['user', 'invoice.items'])
            ->get();

        $grouped = [];
        foreach ($paymentsData as $payment) {
            $userId = $payment->user_id;
            if (! isset($grouped[$userId])) {
                $grouped[$userId] = [
                    'user_id' => $userId,
                    'name' => $payment->user?->name ?? 'Desconocido',
                    'username' => $payment->user?->username ?? '',
                    'payment_count' => 0,
                    'cash_sessions' => [],
                    'invoices' => [],
                    'collected_cents' => 0,
                ];
            }

            $grouped[$userId]['payment_count']++;
            $grouped[$userId]['cash_sessions'][] = $payment->cash_session_id;
            $grouped[$userId]['invoices'][] = $payment->invoice_id;

            $paymentAmountCents = (int) $payment->amount_cents;
            if (! empty($filters['category_id']) || ! empty($filters['area_id'])) {
                $filteredTotalCents = 0;
                $invoice = $payment->invoice;
                if ($invoice) {
                    foreach ($invoice->items as $item) {
                        $matchesCategory = empty($filters['category_id'])
                            || (int) $item->category_id === (int) $filters['category_id'];
                        $matchesArea = empty($filters['area_id'])
                            || (int) $item->area_id === (int) $filters['area_id'];

                        if ($matchesCategory && $matchesArea) {
                            $filteredTotalCents += Money::parseCents((string) $item->line_total, 'line_total');
                        }
                    }
                    $invoiceTotalCents = Money::parseCents((string) $invoice->total, 'invoice_total');
                    if ($invoiceTotalCents > 0) {
                        $collectedCents = $this->prorateCents($paymentAmountCents, $filteredTotalCents, $invoiceTotalCents);
                    } else {
                        $collectedCents = 0;
                    }
                } else {
                    $collectedCents = 0;
                }
            } else {
                $collectedCents = $paymentAmountCents;
            }

            $grouped[$userId]['collected_cents'] += $collectedCents;
        }

        $cashiers = [];
        foreach ($grouped as $userId => $data) {
            $cashiers[] = [
                'name' => $data['name'],
                'username' => $data['username'],
                'payment_count' => $data['payment_count'],
                'cash_session_count' => count(array_unique($data['cash_sessions'])),
                'invoice_count' => count(array_unique($data['invoices'])),
                'total_collected' => $this->centsToMoney($data['collected_cents']),
                'collected_cents_raw' => $data['collected_cents'],
            ];
        }

        usort($cashiers, function ($a, $b) {
            return $b['collected_cents_raw'] <=> $a['collected_cents_raw'];
        });

        foreach ($cashiers as &$cashier) {
            unset($cashier['collected_cents_raw']);
        }

        return [
            'date_from' => $filters['date_from'],
            'date_to' => $filters['date_to'],
            'filters' => [
                'cash_session_id' => $filters['cash_session_id'] ?? null,
                'user_id' => $filters['user_id'] ?? null,
                'category_id' => $filters['category_id'] ?? null,
                'area_id' => $filters['area_id'] ?? null,
                'method' => $filters['method'] ?? null,
                'status' => $filters['status'] ?? null,
            ],
            'summary' => [
                'void_count' => $voidCount,
                'reprint_count' => $reprintCount,
                'service_change_count' => $serviceChangeCount,
                'payment_void_count' => $paymentVoidCount,
                'backup_count' => $backupCount,
                'failed_backup_count' => $failedBackupCount,
                'cashier_count' => count($cashiers),
            ],
            'voids' => $voids,
            'reprints' => $reprints,
            'catalog_changes' => $catalogChanges,
            'payment_voids' => $paymentVoids,
            'backups' => $backups,
            'cashiers' => $cashiers,
        ];
    }

    /**
     * @param  array{cash_session_id?: int, category_id?: int, area_id?: int, method?: string, status?: string}  $filters
     */
    private function hasInvoiceFilters(array $filters): bool
    {
        return ! empty($filters['cash_session_id'])
            || ! empty($filters['category_id'])
            || ! empty($filters['area_id'])
            || ! empty($filters['method'])
            || ! empty($filters['status']);
    }

    private function prorateCents(int $paymentCents, int $filteredTotalCents, int $invoiceTotalCents): int
    {
        if ($paymentCents <= 0 || $filteredTotalCents <= 0 || $invoiceTotalCents <= 0) {
            return 0;
        }

        return intdiv(($paymentCents * $filteredTotalCents) + intdiv($invoiceTotalCents, 2), $invoiceTotalCents);
    }

    /**
     * @param  Collection<int, AuditLog>  $audits
     * @return array<int, string>
     */
    private function categoryNamesFor(Collection $audits): array
    {
        $ids = $this->collectAuditIds($audits, 'category_id');

        if ($ids === []) {
            return [];
        }

        return Category::query()
            ->whereIn('id', $ids)
            ->pluck('name', 'id')
            ->mapWithKeys(fn (string $name, int|string $id): array => [(int) $id => $name])
            ->all();
    }

    /**
     * @param  Collection<int, AuditLog>  $audits
     * @return array<int, string>
     */
    private function areaNamesFor(Collection $audits): array
    {
        $ids = $this->collectAuditIds($audits, 'area_id');

        if ($ids === []) {
            return [];
        }

        return Area::query()
            ->whereIn('id', $ids)
            ->pluck('name', 'id')
            ->mapWithKeys(fn (string $name, int|string $id): array => [(int) $id => $name])
            ->all();
    }

    /**
     * @param  Collection<int, AuditLog>  $audits
     * @return array<int>
     */
    private function collectAuditIds(Collection $audits, string $field): array
    {
        return $audits
            ->flatMap(function (AuditLog $audit) use ($field): array {
                $oldValues = is_array($audit->old_values) ? $audit->old_values : [];
                $newValues = is_array($audit->new_values) ? $audit->new_values : [];

                return [
                    $oldValues[$field] ?? null,
                    $newValues[$field] ?? null,
                ];
            })
            ->filter(fn (mixed $id): bool => is_numeric($id))
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>|null  $values
     * @param  array<int, string>  $categoryNames
     * @param  array<int, string>  $areaNames
     * @return array<string, mixed>
     */
    private function safeServiceValues(?array $values, array $categoryNames, array $areaNames): array
    {
        if ($values === null) {
            return [];
        }

        $safe = [];
        foreach ([
            'name',
            'aliases',
            'price',
            'taxable',
            'active',
            'visible_in_billing',
            'is_billable',
            'special_rule_code',
            'price_change_reason',
        ] as $field) {
            if (array_key_exists($field, $values)) {
                $safe[$field] = $values[$field];
            }
        }

        if (isset($values['category_id']) && is_numeric($values['category_id'])) {
            $safe['category'] = $categoryNames[(int) $values['category_id']] ?? 'Categoria no disponible';
        }

        if (isset($values['area_id']) && is_numeric($values['area_id'])) {
            $safe['area'] = $areaNames[(int) $values['area_id']] ?? 'Area no disponible';
        }

        return $safe;
    }
}
