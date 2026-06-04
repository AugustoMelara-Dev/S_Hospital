<?php

declare(strict_types=1);

namespace App\Http\Requests\Cash;

use Illuminate\Foundation\Http\FormRequest;

class OpenCashSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('cash.open') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'opening_amount' => ['required', 'decimal:0,2', 'min:0', 'max:9999999.99'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
