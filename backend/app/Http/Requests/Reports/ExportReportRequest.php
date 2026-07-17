<?php

namespace App\Http\Requests\Reports;

use App\Models\CashRegisterSession;

class ExportReportRequest extends DateRangeReportRequest
{
    /**
     * @var array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}|null
     */
    private ?array $authorizedFilters = null;

    public function authorize(): bool
    {
        return parent::authorize()
            && $this->user()?->can('reports.export') === true;
    }

    /**
     * @return array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}
     */
    public function authorizedFilters(): array
    {
        if ($this->authorizedFilters !== null) {
            return $this->authorizedFilters;
        }

        $filters = parent::authorizedFilters();

        if (! empty($filters['cash_session_id'])) {
            $cashSession = CashRegisterSession::query()->findOrFail($filters['cash_session_id']);
            $openedDate = $cashSession->opened_at->toDateString();
            $closedDate = $cashSession->closed_at?->toDateString();

            $filters['date_from'] = $openedDate;
            $filters['date_to'] = $closedDate ?? $openedDate;
        }

        return $this->authorizedFilters = $filters;
    }

    public function dateFrom(): string
    {
        return (string) $this->authorizedFilters()['date_from'];
    }

    public function dateTo(): string
    {
        return (string) $this->authorizedFilters()['date_to'];
    }
}
