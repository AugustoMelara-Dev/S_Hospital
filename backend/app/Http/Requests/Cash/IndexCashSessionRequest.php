<?php

namespace App\Http\Requests\Cash;

use Illuminate\Foundation\Http\FormRequest;

class IndexCashSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('cash.view') === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'status' => ['sometimes', 'in:open,closed'],
            'user_id' => ['sometimes', 'integer', 'exists:users,id'],
            // Filtro de lectura/historial: incluye cajas inactivas.
            'cash_register_id' => ['sometimes', 'integer', 'exists:cash_registers,id'],
        ];
    }

    public function perPage(): int
    {
        return (int) $this->integer('per_page', 15);
    }
}
