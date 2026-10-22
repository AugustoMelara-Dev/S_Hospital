<?php

namespace App\Http\Requests\Fiscal;

use Illuminate\Foundation\Http\FormRequest;

class IndexTaxRatesRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && ($user->can('settings.fiscal.view') || $user->can('catalog.view'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'active_only' => ['sometimes', 'boolean'],
        ];
    }
}
