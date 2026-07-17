<?php

namespace App\Http\Requests\Reports;

use Illuminate\Foundation\Http\FormRequest;

class TodayReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        if ($this->user()?->can('reports.view') === true) {
            return true;
        }

        if ($this->user()?->can('cash.view') === true) {
            return true;
        }

        return $this->user()?->can('invoices.view') === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [];
    }
}
