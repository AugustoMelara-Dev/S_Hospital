<?php

namespace App\Http\Requests\Billing;

use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the POS draft for the prevalidation/preview endpoint.
 *
 * The draft shape mirrors StoreInvoiceRequest's lines (service_id, quantity,
 * notes) and keeps `dialysis_prescription` at the payload root, but requires
 * no patient name and performs no emission.
 */
class PreviewInvoiceRequest extends FormRequest
{
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
            'dialysis_prescription' => ['sometimes', 'boolean'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.service_id' => ['required', 'integer', 'exists:services,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01', 'regex:/^\d+(\.\d{1,2})?$/'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array{items: list<array{service_id: int, quantity: string, notes?: string|null}>, dialysis_prescription?: bool}
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

        $payload = ['items' => $items];

        if ($this->exists('dialysis_prescription')) {
            $payload['dialysis_prescription'] = $this->boolean('dialysis_prescription');
        }

        return $payload;
    }
}
