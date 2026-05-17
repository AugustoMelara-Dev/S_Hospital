<?php

namespace App\Http\Requests\Reports;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Throwable;

class DateRangeReportRequest extends FormRequest
{
    public const MAX_RANGE_DAYS = 31;

    public function authorize(): bool
    {
        return $this->user()?->can('reports.managerial.view') === true;
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

        return $dateFrom->copy()->addDays(self::MAX_RANGE_DAYS - 1)->toDateString();
    }
}
