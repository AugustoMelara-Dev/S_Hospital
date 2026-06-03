<?php

namespace App\Http\Requests\Reports;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form request for the dashboard report endpoint.
 *
 * No input parameters required; the dashboard always uses
 * fixed date ranges (today, last 7 days, current month).
 */
class DashboardReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('reports.managerial.view') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
