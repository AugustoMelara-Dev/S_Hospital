<?php

namespace App\Http\Requests\System;

use Illuminate\Foundation\Http\FormRequest;

class IndexAuditLogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('audit.view') === true;
    }

    /**
     * @return array<string, array<int, string>|string>
     */
    public function rules(): array
    {
        return [
            'action' => ['nullable', 'string', 'max:120'],
            'user_id' => ['nullable', 'integer', 'min:1'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    /**
     * @return array{action: string|null, user_id: int|null, from: string|null, to: string|null, per_page: int}
     */
    public function validatedPayload(): array
    {
        return [
            'action' => $this->filled('action') ? $this->string('action')->toString() : null,
            'user_id' => $this->filled('user_id') ? $this->integer('user_id') : null,
            'from' => $this->filled('from') ? $this->string('from')->toString() : null,
            'to' => $this->filled('to') ? $this->string('to')->toString() : null,
            'per_page' => $this->integer('per_page', 25),
        ];
    }
}
