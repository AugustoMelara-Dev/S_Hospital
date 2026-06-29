<?php

namespace App\Http\Requests\Billing;

use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;

class StoreInvoiceRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('patient_name')) {
            $this->merge([
                'patient_name' => trim((string) $this->input('patient_name')),
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
            'items' => ['required', 'array', 'min:1'],
            'items.*.service_id' => ['required', 'integer', 'exists:services,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01', 'regex:/^\d+(\.\d{1,2})?$/'],
            'items.*.notes' => ['nullable', 'string', 'max:255'],
        ];
    }
}
