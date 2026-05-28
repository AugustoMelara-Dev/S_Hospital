<?php

namespace App\Http\Requests\Reports;

use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PdfExportReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('reports.export') === true;
    }

    public function rules(): array
    {
        return [
            'date' => ['sometimes', 'date_format:Y-m-d'],
            'date_from' => ['required_without:date', 'date_format:Y-m-d'],
            'date_to' => [
                'required_without:date',
                'date_format:Y-m-d',
                'after_or_equal:date_from',
            ],
            'cash_session_id' => ['sometimes', 'integer', 'exists:cash_register_sessions,id'],
            'user_id' => ['sometimes', 'integer', 'exists:users,id'],
            'category_id' => ['sometimes', 'integer', 'exists:categories,id'],
            'method' => ['sometimes', Rule::in(Payment::METHODS)],
            'status' => ['sometimes', Rule::in([
                Invoice::STATUS_ISSUED,
                Invoice::STATUS_PARTIAL,
                Invoice::STATUS_PAID,
                Invoice::STATUS_VOID,
            ])],
        ];
    }
}
