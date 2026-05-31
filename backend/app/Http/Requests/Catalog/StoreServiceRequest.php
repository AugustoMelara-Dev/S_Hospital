<?php

namespace App\Http\Requests\Catalog;

use App\Models\Service;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('catalog.manage') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:160'],
            'aliases' => ['nullable', 'string', 'max:1000'],
            'price' => ['required', 'decimal:0,2', 'min:0'],
            'scan_code' => ['nullable', 'string', 'max:120', 'unique:services,scan_code'],
            'barcode' => ['nullable', 'string', 'max:120', 'unique:services,barcode'],
            'qr_code' => ['nullable', 'string', 'max:120', 'unique:services,qr_code'],
            'taxable' => ['sometimes', 'boolean'],
            'active' => ['sometimes', 'boolean'],
            'visible_in_billing' => ['sometimes', 'boolean'],
            'is_billable' => ['sometimes', 'boolean'],
            'special_rule_code' => ['nullable', 'string', Rule::in([Service::ERYTHROPOIETIN_RULE])],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->filled('category_id') && $this->filled('name')) {
                    $exists = Service::query()
                        ->where('category_id', $this->integer('category_id'))
                        ->where('slug', Str::slug($this->string('name')))
                        ->exists();

                    if ($exists) {
                        $validator->errors()->add('name', 'Ya existe un servicio con un nombre equivalente en esta categoria.');
                    }
                }

                $this->validateGlobalCodes($validator);
            },
        ];
    }

    private function validateGlobalCodes(Validator $validator): void
    {
        $codes = collect(['scan_code', 'barcode', 'qr_code'])
            ->mapWithKeys(fn (string $field): array => [$field => trim((string) $this->input($field, ''))])
            ->filter();

        if ($codes->isEmpty()) {
            return;
        }

        if ($codes->unique()->count() !== $codes->count()) {
            foreach ($codes as $field => $code) {
                $validator->errors()->add($field, 'El codigo ya esta asignado a este servicio en otro campo.');
            }

            return;
        }

        foreach ($codes as $field => $code) {
            $exists = Service::query()
                ->where(function ($query) use ($code): void {
                    $query
                        ->where('scan_code', $code)
                        ->orWhere('barcode', $code)
                        ->orWhere('qr_code', $code);
                })
                ->exists();

            if ($exists) {
                $validator->errors()->add($field, 'El codigo ya esta asignado a otro servicio.');
            }
        }
    }
}
