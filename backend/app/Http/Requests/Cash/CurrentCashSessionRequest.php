<?php

namespace App\Http\Requests\Cash;

use Illuminate\Foundation\Http\FormRequest;

class CurrentCashSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('cash.view') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'scope' => ['sometimes', 'string', 'in:own,closable'],
            // Filtro de lectura: se permite consultar cajas inactivas para
            // cerrar/reportar sesiones historicas; la apertura si exige `active`.
            'cash_register_id' => ['sometimes', 'integer', 'exists:cash_registers,id'],
        ];
    }
}
