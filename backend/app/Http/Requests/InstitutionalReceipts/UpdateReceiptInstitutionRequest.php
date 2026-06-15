<?php

namespace App\Http\Requests\InstitutionalReceipts;

use Illuminate\Foundation\Http\FormRequest;

class UpdateReceiptInstitutionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('receipt_settings.update') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'hospital_name' => ['required', 'string', 'max:255'],
            'rtn' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string', 'max:255'],
            'slogan' => ['nullable', 'string', 'max:255'],
            'government_line' => ['nullable', 'string', 'max:120'],
            'secretariat_line' => ['nullable', 'string', 'max:160'],
            'receipt_location' => ['nullable', 'string', 'max:160'],
            'receipt_footer_text' => ['nullable', 'string', 'max:255'],
            'receipt_template_mode' => ['sometimes', 'required', 'string', 'in:institutional'],
        ];
    }
}
