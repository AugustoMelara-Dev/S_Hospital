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

    public function rules(): array
    {
        return [
            'cash_session_id' => ['required', 'integer', 'exists:cash_register_sessions,id'],
            'method' => ['required', Rule::in(Payment::METHODS)],
            'amount' => ['required', 'decimal:0,2', 'min:0.01'],
            'reference' => ['nullable', 'string', 'max:120'],
        ];
    }
}
