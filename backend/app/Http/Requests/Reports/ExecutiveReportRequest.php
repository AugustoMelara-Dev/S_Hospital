<?php

namespace App\Http\Requests\Reports;

use App\Http\Requests\Reports\Concerns\BuildsValidatedReportFilters;
use App\Models\CashRegisterSession;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExecutiveReportRequest extends FormRequest
{
    use BuildsValidatedReportFilters;

    public const MAX_RANGE_DAYS = 92;

    public function authorize(): bool
    {
        if ($this->user()?->can('reports.managerial.view') === true) {
            return true;
        }

        return $this->filled('cash_session_id')
            && $this->user()?->can('reports.cash_session.view') === true;
    }

    /** @return array<string, mixed> */
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
            'method' => ['sometimes', Rule::in([
                'cash',
                'transfer',
                'card',
                'other',
            ])],
            'status' => ['sometimes', Rule::in([
                'issued',
                'partial',
                'paid',
                'void',
            ])],
        ];
    }

    public function messages(): array
    {
        return [
            'date_to.before_or_equal' => 'El rango maximo permitido para el reporte ejecutivo es de '.self::MAX_RANGE_DAYS.' dias.',
        ];
    }

    public function dateFrom(): string
    {
        return $this->string('date_from')->toString();
    }

    public function dateTo(): string
    {
        return $this->string('date_to')->toString();
    }

    /**
     * @return array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}
     */
    public function authorizedFilters(): array
    {
        $filters = $this->validatedReportFilters();
        $user = $this->user();

        if (! $user instanceof User) {
            abort(403);
        }

        if ($user->can('reports.managerial.view')) {
            return $filters;
        }

        if (
            ! empty($filters['cash_session_id'])
            && CashRegisterSession::query()
                ->whereKey($filters['cash_session_id'])
                ->where('user_id', $user->id)
                ->doesntExist()
        ) {
            abort(403);
        }

        $filters['user_id'] = $user->id;

        return $filters;
    }

    private function maxDateTo(): string
    {
        return $this->maximumDateTo($this->input('date_from'), self::MAX_RANGE_DAYS);
    }
}
