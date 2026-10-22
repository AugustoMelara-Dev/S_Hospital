<?php

namespace App\Http\Requests\Catalog;

use App\Models\Service;
use Illuminate\Foundation\Http\FormRequest;

class IndexServiceHistoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $service = $this->route('service');

        return $service instanceof Service
            && $this->user()?->can('view', $service) === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }

    public function perPage(): int
    {
        return (int) $this->integer('per_page', 20);
    }
}
