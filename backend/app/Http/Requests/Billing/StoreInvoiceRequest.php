<?php

namespace App\Http\Requests\Billing;

use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;

class StoreInvoiceRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('patient_name')) {
            $patientName = $this->input('patient_name');

            if (! is_string($patientName)) {
                return;
            }

            $this->merge([
                'patient_name' => trim($patientName),
            ]);
        }
    }

    public function authorize(): bool
    {
        return $this->user()?->can('create', Invoice::class) === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'patient_name' => ['required', 'string', 'min:1', 'max:180'],
            'dialysis_prescription' => ['sometimes', 'boolean'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.service_id' => ['required', 'integer', 'exists:services,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01', 'regex:/^\d+(\.\d{1,2})?$/'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array{patient_name: string, items: list<array{service_id: int, quantity: string, notes?: string|null}>, dialysis_prescription?: bool}
     */
    public function payload(): array
    {
        $validatedItems = $this->validated('items');
        $items = [];

        if (is_array($validatedItems)) {
            foreach (array_keys($validatedItems) as $index) {
                $item = [
                    'service_id' => $this->integer("items.{$index}.service_id"),
                    'quantity' => $this->string("items.{$index}.quantity")->toString(),
                ];

                if ($this->exists("items.{$index}.notes")) {
                    $item['notes'] = $this->input("items.{$index}.notes") === null
                        ? null
                        : $this->string("items.{$index}.notes")->toString();
                }

                $items[] = $item;
            }
        }

        $payload = [
            'patient_name' => $this->string('patient_name')->toString(),
            'items' => $items,
        ];

        if ($this->exists('dialysis_prescription')) {
            $payload['dialysis_prescription'] = $this->boolean('dialysis_prescription');
        }

        return $payload;
    }
}
