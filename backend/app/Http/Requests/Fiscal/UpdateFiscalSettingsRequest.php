<?php

namespace App\Http\Requests\Fiscal;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFiscalSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('settings.fiscal.update') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'hospital_name' => ['required', 'string', 'max:255'],
            'rtn' => ['required', 'string', 'max:32'],
            'default_tax_rate' => ['required', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
            'receipt_width' => ['required', 'in:80mm,58mm'],
            'primary_color' => ['required', 'string', 'in:teal,blue,indigo,green,rose'],
            'address' => ['nullable', 'string', 'max:255'],
            'slogan' => ['nullable', 'string', 'max:255'],
        ];
    }
}
