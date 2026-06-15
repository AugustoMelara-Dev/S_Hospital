<?php

namespace App\Http\Requests\InstitutionalReceipts;

use Illuminate\Foundation\Http\FormRequest;

class IssueInstitutionalReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user?->can('receipts.view') === true
            && $user->can('payments.create') === true;
    }

    public function rules(): array
    {
        return [
            'invoice_id' => ['required', 'integer', 'exists:invoices,id'],
            'payment_id' => ['nullable', 'integer', 'exists:payments,id'],
            'cash_session_id' => ['nullable', 'integer', 'exists:cash_register_sessions,id'],
            'profile_id' => ['nullable', 'integer', 'exists:receipt_print_profiles,id', 'prohibits:profile_code'],
            'profile_code' => ['nullable', 'string', 'max:80', 'exists:receipt_print_profiles,code', 'prohibits:profile_id'],
        ];
    }
}
