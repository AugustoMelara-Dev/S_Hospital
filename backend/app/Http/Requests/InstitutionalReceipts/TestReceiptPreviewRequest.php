<?php

namespace App\Http\Requests\InstitutionalReceipts;

use Illuminate\Foundation\Http\FormRequest;

class TestReceiptPreviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user?->can('receipts.print_test') === true
            || $user?->can('receipt_settings.update') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'profile_id' => ['nullable', 'integer', 'exists:receipt_print_profiles,id'],
            'profile_code' => ['nullable', 'string', 'exists:receipt_print_profiles,code'],
            'payer_name' => ['sometimes', 'required', 'string', 'max:180'],
            'concept' => ['sometimes', 'required', 'string', 'max:500'],
            'amount' => ['sometimes', 'required', 'numeric', 'min:0', 'max:9999999999.99', 'decimal:0,2'],
        ];
    }
}
