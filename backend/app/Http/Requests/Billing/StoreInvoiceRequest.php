<?php

namespace App\Http\Requests\Billing;

use Illuminate\Foundation\Http\FormRequest;

class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', \App\Models\Invoice::class) === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'patient_name' => ['required', 'string', 'max:180'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.service_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'decimal:0,2', 'min:0.01'],
            'items.*.dialysis_prescription' => ['sometimes', 'boolean'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ];
    }
}
