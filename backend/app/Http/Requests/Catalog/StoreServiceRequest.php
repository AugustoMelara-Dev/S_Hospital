<?php

namespace App\Http\Requests\Catalog;

use App\Models\Service;
use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class StoreServiceRequest extends FormRequest
{
    private const ERYTHROPOIETIN_PRICE_CENTS = 2500;

    protected function prepareForValidation(): void
    {
        if (is_array($this->input('aliases'))) {
            $this->merge([
                'aliases' => implode(', ', array_values(array_filter(
                    $this->input('aliases'),
                    fn ($alias): bool => is_string($alias) && trim($alias) !== '',
                ))),
            ]);
        }
    }

    public function authorize(): bool
    {
        return $this->user()?->can('create', Service::class) === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'area_id' => ['required', 'integer', 'exists:areas,id'],
            'name' => ['required', 'string', 'max:160'],
            'aliases' => ['nullable', 'string', 'max:1000'],
            'price' => ['required', 'decimal:0,2', 'gt:0'],
            'scan_code' => ['nullable', 'string', 'max:120', 'unique:services,scan_code'],
            'barcode' => ['nullable', 'string', 'max:120', 'unique:services,barcode'],
            'qr_code' => ['nullable', 'string', 'max:120', 'unique:services,qr_code'],
            'description' => ['nullable', 'string', 'max:255'],
            'internal_code' => ['nullable', 'string', 'max:80', 'unique:services,internal_code'],
            'taxable' => ['sometimes', 'boolean'],
            'active' => ['sometimes', 'boolean'],
            'visible_in_billing' => ['sometimes', 'boolean'],
            'is_billable' => ['sometimes', 'boolean'],
            'special_rule_code' => ['prohibited'],
            'print_on_receipt' => ['sometimes', 'boolean'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->filled('category_id') && $this->filled('name')) {
                    $areaId = $this->has('area_id') && $this->input('area_id') !== null
                        ? $this->integer('area_id')
                        : null;
                    $exists = Service::query()
                        ->where('category_id', $this->integer('category_id'))
                        ->where(function (Builder $query) use ($areaId): void {
                            $areaId === null
                                ? $query->whereNull('area_id')
                                : $query->where('area_id', $areaId);
                        })
                        ->where('slug', Str::slug($this->string('name')))
                        ->exists();

                    if ($exists) {
                        $validator->errors()->add('name', 'Ya existe un servicio con un nombre equivalente en esta categoria y area.');
                    }
                }

                $this->validateErythropoietinFixedPrice($validator);
                $this->validateErythropoietinTaxStatus($validator);
                $this->validateGlobalCodes($validator);
            },
        ];
    }

    private function validateErythropoietinFixedPrice(Validator $validator): void
    {
        if ($validator->errors()->has('price') || $this->input('special_rule_code') !== Service::ERYTHROPOIETIN_RULE) {
            return;
        }

        if (Money::parseCents($this->string('price')->toString(), 'price') !== self::ERYTHROPOIETIN_PRICE_CENTS) {
            $validator->errors()->add('price', 'Eritropoyetina debe mantener precio fijo de L.25.00.');
        }
    }

    private function validateErythropoietinTaxStatus(Validator $validator): void
    {
        if ($validator->errors()->has('taxable') || $this->input('special_rule_code') !== Service::ERYTHROPOIETIN_RULE) {
            return;
        }

        if ($this->boolean('taxable', true)) {
            $validator->errors()->add('taxable', 'Eritropoyetina debe registrarse sin impuesto.');
        }
    }

    private function validateGlobalCodes(Validator $validator): void
    {
        $codes = collect(['scan_code', 'barcode', 'qr_code'])
            ->mapWithKeys(function (string $field): array {
                $value = $this->input($field, '');

                return [$field => is_string($value) ? trim($value) : ''];
            })
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
