<?php

namespace App\Http\Requests\Reports;

use Illuminate\Foundation\Http\FormRequest;

class MonthlyReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('reports.managerial.view') === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'month' => ['sometimes', 'date_format:Y-m'],
        ];
    }

    public function reportMonth(): string
    {
        return $this->filled('month')
            ? $this->string('month')->toString()
            : now()->format('Y-m');
    }
}
