<?php

namespace App\Http\Requests\Catalog;

use App\Models\Service;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('catalog.manage') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:160'],
            'price' => ['required', 'decimal:0,2', 'min:0'],
            'taxable' => ['sometimes', 'boolean'],
            'active' => ['sometimes', 'boolean'],
            'special_rule_code' => ['nullable', 'string', Rule::in([Service::ERYTHROPOIETIN_RULE])],
        ];
    }
}
