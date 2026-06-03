<?php

namespace App\Http\Requests\Payments;

use App\Models\Payment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('payments.create') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'cash_session_id' => ['required', 'integer', 'exists:cash_register_sessions,id'],
            'method' => ['required', Rule::in(Payment::METHODS)],
            'amount' => ['required', 'string', 'regex:/^-?\d{1,9}(\.\d{1,2})?$/'],
            'reference' => ['nullable', 'string', 'max:120'],
        ];
    }
}
