<?php

namespace App\Http\Requests\Reports;

use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Throwable;

class PdfExportRequest extends FormRequest
{
    /**
     * @var array<string, mixed>|null
     */
    private ?array $authorizedReportFilters = null;

    public function authorize(): bool
    {
        if ($this->user()?->can('reports.export') !== true) {
            return false;
        }

        if ($this->isDailyClosure()) {
            return $this->user()?->can('reports.managerial.view') === true;
        }

        return $this->user()?->can('reports.managerial.view') === true
            || $this->user()?->can('reports.cash_session.view') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        if ($this->isDailyClosure()) {
            return [
                'date' => ['sometimes', 'date_format:Y-m-d'],
            ];
        }

        return [
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:date_from',
                'before_or_equal:'.$this->maxDateTo(),
            ],
            'cash_session_id' => ['sometimes', 'integer', 'exists:cash_register_sessions,id'],
            'user_id' => ['sometimes', 'integer', 'exists:users,id'],
            'category_id' => ['sometimes', 'integer', 'exists:categories,id'],
            'area_id' => ['sometimes', 'integer', 'exists:areas,id'],
            'method' => ['sometimes', Rule::in(Payment::METHODS)],
            'status' => ['sometimes', Rule::in([
                Invoice::STATUS_ISSUED,
                Invoice::STATUS_PARTIAL,
                Invoice::STATUS_PAID,
                Invoice::STATUS_VOID,
            ])],
        ];
    }

    public function messages(): array
    {
        return [
            'date_to.before_or_equal' => 'El rango maximo permitido para reportes es de '.DateRangeReportRequest::MAX_RANGE_DAYS.' dias.',
        ];
    }

    public function isDailyClosure(): bool
    {
        return $this->filled('date') || (! $this->filled('date_from') && ! $this->filled('date_to'));
    }

    public function reportDate(): string
    {
        return (string) ($this->input('date') ?: now()->toDateString());
    }

    /**
     * @return array<string, mixed>
     */
    public function reportFilters(): array
    {
        return [
            'date_from' => $this->input('date_from'),
            'date_to' => $this->input('date_to'),
            'cash_session_id' => $this->input('cash_session_id'),
            'user_id' => $this->input('user_id'),
            'category_id' => $this->input('category_id'),
            'area_id' => $this->input('area_id'),
            'method' => $this->input('method'),
            'status' => $this->input('status'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function authorizedReportFilters(): array
    {
        if ($this->authorizedReportFilters !== null) {
            return $this->authorizedReportFilters;
        }

        $filters = $this->reportFilters();

        if ($this->user()?->can('reports.managerial.view') === true) {
            return $this->authorizedReportFilters = $this->normalizeCashSessionDateRange($filters);
        }

        abort_if(empty($filters['cash_session_id']), 403);

        $ownsCashSession = CashRegisterSession::query()
            ->whereKey($filters['cash_session_id'])
            ->where('user_id', $this->user()?->id)
            ->exists();

        abort_unless($ownsCashSession, 403);

        $filters['user_id'] = $this->user()?->id;

        return $this->authorizedReportFilters = $this->normalizeCashSessionDateRange($filters);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function normalizeCashSessionDateRange(array $filters): array
    {
        if (empty($filters['cash_session_id'])) {
            return $filters;
        }

        $cashSession = CashRegisterSession::query()->findOrFail($filters['cash_session_id']);
        $openedDate = $cashSession->opened_at?->toDateString();
        $closedDate = $cashSession->closed_at?->toDateString();

        if ($openedDate !== null) {
            $filters['date_from'] = $openedDate;
            $filters['date_to'] = $closedDate ?? $openedDate;
        }

        return $filters;
    }

    private function maxDateTo(): string
    {
        $rawDateFrom = $this->input('date_from');

        if (! is_string($rawDateFrom) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawDateFrom)) {
            return '9999-12-31';
        }

        try {
            $dateFrom = Carbon::createFromFormat('Y-m-d', $rawDateFrom);
        } catch (Throwable) {
            return '9999-12-31';
        }

        if ($dateFrom->format('Y-m-d') !== $rawDateFrom) {
            return '9999-12-31';
        }

        return $dateFrom->copy()->addDays(DateRangeReportRequest::MAX_RANGE_DAYS - 1)->toDateString();
    }
}
