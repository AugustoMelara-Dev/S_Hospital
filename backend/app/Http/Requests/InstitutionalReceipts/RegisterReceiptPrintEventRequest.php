<?php

namespace App\Http\Requests\InstitutionalReceipts;

use Illuminate\Foundation\Http\FormRequest;

class RegisterReceiptPrintEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('receipts.view') === true;
    }

    public function rules(): array
    {
        return [
            'reason' => ['nullable', 'string', 'min:5', 'max:500'],
        ];
    }
}
