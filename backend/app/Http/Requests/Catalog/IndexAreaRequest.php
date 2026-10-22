<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class IndexAreaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->canAny(['catalog.view', 'catalog.manage']) === true
            || $this->user()?->can('reports.managerial.view') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
