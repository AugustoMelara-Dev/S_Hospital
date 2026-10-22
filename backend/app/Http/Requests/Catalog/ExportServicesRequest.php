<?php

namespace App\Http\Requests\Catalog;

use App\Models\Service;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExportServicesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Service::class) === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'format' => ['sometimes', 'string', Rule::in(['csv', 'xlsx'])],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    public function requestedFormat(): string
    {
        return $this->input('format') === 'xlsx' ? 'xlsx' : 'csv';
    }
}
