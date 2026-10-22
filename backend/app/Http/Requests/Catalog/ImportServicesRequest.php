<?php

namespace App\Http\Requests\Catalog;

use App\Models\Service;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * H-16: catalog import (CSV/XLSX). `preview` validates without writing;
 * `apply` persists the valid rows and reports the rejected ones.
 */
class ImportServicesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Service::class) === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:10240', 'mimes:csv,txt,xlsx'],
            'mode' => ['sometimes', 'string', Rule::in(['preview', 'apply'])],
            'reason' => ['nullable', 'string', 'min:5', 'max:500'],
        ];
    }

    public function mode(): string
    {
        $mode = $this->input('mode', 'preview');

        return $mode === 'apply' ? 'apply' : 'preview';
    }

    public function reason(): ?string
    {
        $reason = trim($this->string('reason')->toString());

        return $reason === '' ? null : $reason;
    }
}
