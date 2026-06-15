<?php

namespace App\Http\Requests\InstitutionalReceipts;

use Illuminate\Foundation\Http\FormRequest;

class ViewReceiptSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('receipt_settings.view') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
