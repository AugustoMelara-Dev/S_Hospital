<?php

namespace App\Http\Requests\Fiscal;

use Illuminate\Foundation\Http\FormRequest;

class StoreTaxRateRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:60'],
            'percentage' => ['required', 'numeric', 'min:0', 'max:99.99'],
            'active' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
            'reason' => ['required', 'string', 'max:255'],
        ];
    }
}
