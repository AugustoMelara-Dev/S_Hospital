<?php

namespace App\Http\Requests\Reports;

use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Throwable;

class DateRangeReportRequest extends FormRequest
{
    public const MAX_RANGE_DAYS = 31;

    public function authorize(): bool
    {
        if ($this->user()?->can('reports.managerial.view') === true) {
            return true;
        }

        return $this->filled('cash_session_id')
            && $this->user()?->can('reports.cash_session.view') === true;
    }

    public function rules(): array
    {
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
            'date_to.before_or_equal' => 'El rango maximo permitido para reportes es de '.self::MAX_RANGE_DAYS.' dias.',
        ];
    }

    public function dateFrom(): string
    {
        return (string) $this->date('date_from')->toDateString();
    }

    public function dateTo(): string
    {
        return (string) $this->date('date_to')->toDateString();
    }

    /**
     * @return array<string, mixed>
     */
    public function authorizedFilters(): array
    {
        $filters = $this->validated();

        if ($this->user()?->can('reports.managerial.view') === true) {
            return $filters;
        }

        if (
            ! empty($filters['cash_session_id'])
            && CashRegisterSession::query()
                ->whereKey($filters['cash_session_id'])
                ->where('user_id', $this->user()?->id)
                ->doesntExist()
        ) {
            abort(403);
        }

        $filters['user_id'] = $this->user()?->id;

        return $filters;
    }

    private function maxDateTo(): string
    {
        $rawDateFrom = $this->input('date_from');

        if (! is_string($rawDateFrom) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawDateFrom)) {
            return Carbon::now()->addDays(self::MAX_RANGE_DAYS - 1)->toDateString();
        }

        try {
            $dateFrom = Carbon::createFromFormat('Y-m-d', $rawDateFrom);
        } catch (Throwable) {
            return Carbon::now()->addDays(self::MAX_RANGE_DAYS - 1)->toDateString();
        }

        if ($dateFrom->format('Y-m-d') !== $rawDateFrom) {
            return Carbon::now()->addDays(self::MAX_RANGE_DAYS - 1)->toDateString();
        }

        return $dateFrom->copy()->addDays(self::MAX_RANGE_DAYS - 1)->toDateString();
    }
}
