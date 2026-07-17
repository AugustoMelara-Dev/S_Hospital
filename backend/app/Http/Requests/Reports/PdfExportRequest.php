<?php

namespace App\Http\Requests\Reports;

use App\Http\Requests\Reports\Concerns\BuildsValidatedReportFilters;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PdfExportRequest extends FormRequest
{
    use BuildsValidatedReportFilters;

    /**
     * @var array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}|null
     */
    private ?array $authorizedReportFilters = null;

    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user instanceof User || ! $user->can('reports.export')) {
            return false;
        }

        if ($this->isDailyClosure()) {
            return $user->can('reports.managerial.view');
        }

        return $user->can('reports.managerial.view')
            || $user->can('reports.cash_session.view');
    }

    /** @return array<string, mixed> */
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
     * @return array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}
     */
    public function reportFilters(): array
    {
        return $this->validatedReportFilters();
    }

    /**
     * @return array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}
     */
    public function authorizedReportFilters(): array
    {
        if ($this->authorizedReportFilters !== null) {
            return $this->authorizedReportFilters;
        }

        $filters = $this->reportFilters();
        $user = $this->user();
        if (! $user instanceof User) {
            abort(403);
        }

        if ($user->can('reports.managerial.view')) {
            return $this->authorizedReportFilters = $this->normalizeCashSessionDateRange($filters);
        }

        abort_if(empty($filters['cash_session_id']), 403);

        $ownsCashSession = CashRegisterSession::query()
            ->whereKey($filters['cash_session_id'])
            ->where('user_id', $user->id)
            ->exists();

        abort_unless($ownsCashSession, 403);

        $filters['user_id'] = $user->id;

        return $this->authorizedReportFilters = $this->normalizeCashSessionDateRange($filters);
    }

    private function maxDateTo(): string
    {
        return $this->maximumDateTo($this->input('date_from'), DateRangeReportRequest::MAX_RANGE_DAYS);
    }
}
