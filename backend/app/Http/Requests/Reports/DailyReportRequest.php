<?php

namespace App\Http\Requests\Reports;

use Illuminate\Foundation\Http\FormRequest;

class DailyReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('reports.managerial.view') === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'date' => ['sometimes', 'date_format:Y-m-d'],
        ];
    }

    public function reportDate(): string
    {
        return $this->filled('date')
            ? $this->string('date')->toString()
            : now()->toDateString();
    }
}
