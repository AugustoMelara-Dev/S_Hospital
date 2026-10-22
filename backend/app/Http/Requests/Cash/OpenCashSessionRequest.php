<?php

namespace App\Http\Requests\Cash;

use App\Actions\Cash\OpenCashSessionAction;
use App\Models\CashRegister;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
            // El ID de caja nunca se acepta a ciegas: debe existir y estar activo.
            'cash_register_id' => [
                'sometimes',
                'integer',
                Rule::exists('cash_registers', 'id')->where('active', true),
            ],
        ];
    }

    /** @return array{opening_amount: string, notes?: string|null, cash_register_id: int} */
    public function payload(): array
    {
        $payload = [
            'opening_amount' => $this->string('opening_amount')->toString(),
            'cash_register_id' => $this->resolveCashRegisterId(),
        ];

        if ($this->exists('notes')) {
            $payload['notes'] = $this->input('notes') === null
                ? null
                : $this->string('notes')->toString();
        }

        return $payload;
    }

    /**
     * Resuelve la caja en el servidor. Si el navegador no envia caja se usa la
     * `principal` del modo simple; si envia una, ya fue validada como existente
     * y activa por `rules()`.
     */
    public function resolveCashRegisterId(): int
    {
        $requested = $this->input('cash_register_id');

        if (is_int($requested)) {
            return $requested;
        }

        if (is_string($requested) && is_numeric($requested)) {
            return (int) $requested;
        }

        $principalId = $this->toIntId(
            CashRegister::query()
                ->where('code', OpenCashSessionAction::DEFAULT_REGISTER_CODE)
                ->where('active', true)
                ->value('id'),
        );

        if ($principalId === null) {
            throw ValidationException::withMessages([
                'cash_register_id' => 'No hay una caja principal activa configurada.',
            ]);
        }

        return $principalId;
    }

    private function toIntId(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_string($value) && is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }
}
