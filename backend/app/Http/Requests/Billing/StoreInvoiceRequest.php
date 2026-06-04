<?php

declare(strict_types=1);

namespace App\Http\Requests\Billing;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('invoices.create') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'patient_name' => [
                'required',
                'string',
                'min:1',
                'max:180',
                'regex:/^[\pL\pN\s\.\,\-\'\"]+$/u',
            ],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.service_id' => ['required', 'integer', 'min:1', 'exists:services,id'],
            'items.*.quantity' => [
                'required',
                'numeric',
                'min:0.01',
                'max:1000',
                'regex:/^\d+(\.\d{1,2})?$/',
            ],
            'items.*.dialysis_prescription' => ['sometimes', 'boolean'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $name = trim((string) $this->input('patient_name', ''));

                if ($name === '') {
                    return;
                }

                if (preg_match('/^\d+$/', $name)) {
                    $validator->errors()->add('patient_name', 'El nombre del paciente no puede ser solo numeros.');
                }

                if (mb_strlen($name) < 2) {
                    $validator->errors()->add('patient_name', 'El nombre del paciente debe tener al menos 2 caracteres.');
                }
            },
        ];
    }
}
