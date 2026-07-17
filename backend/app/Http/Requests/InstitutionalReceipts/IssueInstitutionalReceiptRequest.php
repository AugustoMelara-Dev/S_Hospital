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

    /** @return array<string, mixed> */
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

    /**
     * @return array{invoice_id: int, payment_id?: int|null, cash_session_id?: int|null, profile_id?: int|null, profile_code?: string|null}
     */
    public function payload(): array
    {
        $payload = [
            'invoice_id' => $this->integer('invoice_id'),
        ];

        foreach (['payment_id', 'cash_session_id', 'profile_id'] as $key) {
            if ($this->exists($key)) {
                $payload[$key] = $this->input($key) === null ? null : $this->integer($key);
            }
        }

        if ($this->exists('profile_code')) {
            $payload['profile_code'] = $this->input('profile_code') === null
                ? null
                : $this->string('profile_code')->toString();
        }

        return $payload;
    }
}
