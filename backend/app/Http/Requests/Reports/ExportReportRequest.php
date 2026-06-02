<?php

namespace App\Http\Requests\Reports;

class ExportReportRequest extends DateRangeReportRequest
{
    public function authorize(): bool
    {
        return parent::authorize()
            && $this->user()?->can('reports.export') === true;
    }
}
