<?php

declare(strict_types=1);

namespace App\Http\Requests\Reports;

use App\Models\Area;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Throwable;

class AreaPaidServicesRequest extends FormRequest
{
    public const MAX_RANGE_DAYS = 31;

    public function authorize(): bool
    {
        $user = $this->user();
        $area = $this->route('area');

        if (! $user || ! $area instanceof Area) {
            return false;
        }

        if ($user->can('reports.managerial.view')) {
            return true;
        }

        return $user->can('areas.paid_services.view')
            && $user->area_id !== null
            && (int) $user->area_id === (int) $area->id;
    }

    /**
     * @return array<string, mixed>
     */
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
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'date_to.before_or_equal' => 'El rango maximo permitido para servicios pagados por area es de '.self::MAX_RANGE_DAYS.' dias.',
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

    public function page(): int
    {
        return max(1, (int) $this->input('page', 1));
    }

    public function perPage(): int
    {
        return min(100, max(1, (int) $this->input('per_page', 50)));
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
