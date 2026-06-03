<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class IndexServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('catalog.view') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'string', 'max:120'],
            'code' => ['sometimes', 'string', 'max:120'],
            'category_id' => ['sometimes', 'integer', 'exists:categories,id'],
            'area_id' => ['sometimes', 'integer', 'exists:areas,id'],
            'active' => ['sometimes', 'boolean'],
            'billing' => ['sometimes', 'boolean'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:150'],
        ];
    }

    public function perPage(): int
    {
        return (int) $this->integer('per_page', 100);
    }
}
