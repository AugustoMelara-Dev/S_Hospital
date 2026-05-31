<?php

namespace App\Http\Requests\System;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreClientErrorLogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'event_type' => ['required', 'string', 'max:80'],
            'severity' => ['required', 'string', Rule::in(['info', 'warning', 'error'])],
            'safe_message' => ['required', 'string', 'max:500'],
            'technical_code' => ['nullable', 'string', 'max:80'],
            'route' => ['nullable', 'string', 'max:180'],
            'status_code' => ['nullable', 'integer', 'min:0', 'max:599'],
            'context' => ['nullable', 'array'],
            'occurred_at' => ['nullable', 'date'],
        ];
    }
}
