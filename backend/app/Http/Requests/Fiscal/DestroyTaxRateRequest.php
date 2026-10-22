<?php

namespace App\Http\Requests\Fiscal;

use Illuminate\Foundation\Http\FormRequest;

class DestroyTaxRateRequest extends FormRequest
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
            'reason' => ['required', 'string', 'max:255'],
        ];
    }
}
