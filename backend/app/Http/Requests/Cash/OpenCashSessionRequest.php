<?php

namespace App\Http\Requests\Cash;

use Illuminate\Foundation\Http\FormRequest;

class OpenCashSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('cash.open') === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'opening_amount' => ['required', 'decimal:0,2', 'min:0'],
            'notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    /** @return array{opening_amount: string, notes?: string|null} */
    public function payload(): array
    {
        $payload = [
            'opening_amount' => $this->string('opening_amount')->toString(),
        ];

        if ($this->exists('notes')) {
            $payload['notes'] = $this->input('notes') === null
                ? null
                : $this->string('notes')->toString();
        }

        return $payload;
    }
}
