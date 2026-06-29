<?php

namespace App\Http\Requests\Billing;

use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', \App\Models\Invoice::class) === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'date_from' => ['sometimes', 'date'],
            'date_to' => ['sometimes', 'date', 'after_or_equal:date_from'],
            'status' => ['sometimes', Rule::in([
                Invoice::STATUS_ISSUED,
                Invoice::STATUS_PARTIAL,
                Invoice::STATUS_PAID,
                Invoice::STATUS_VOID,
            ])],
            'patient' => ['sometimes', 'string', 'max:180'],
            'invoice_number' => ['sometimes', 'string', 'max:80'],
            'user_id' => ['sometimes', 'integer', 'exists:users,id'],
            'cash_session_id' => ['sometimes', 'integer', 'exists:cash_register_sessions,id'],
        ];
    }

    public function perPage(): int
    {
        return (int) $this->integer('per_page', 15);
    }
}
