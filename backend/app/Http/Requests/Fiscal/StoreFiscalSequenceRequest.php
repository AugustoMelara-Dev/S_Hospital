<?php

namespace App\Http\Requests\Fiscal;

use Illuminate\Foundation\Http\FormRequest;

class StoreFiscalSequenceRequest extends FormRequest
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
            'document_type' => ['required', 'string', 'max:32', 'in:invoice'],
            'prefix' => ['required', 'string', 'max:32'],
            'min_number' => ['required', 'integer', 'min:1'],
            'max_number' => ['required', 'integer', 'gte:min_number'],
            'current_number' => ['required', 'integer', 'min:0', 'lt:max_number'],
            'cai' => ['required', 'string', 'max:128'],
            'valid_until' => ['required', 'date', 'after_or_equal:today'],
            'active' => ['required', 'boolean'],
        ];
    }
}
