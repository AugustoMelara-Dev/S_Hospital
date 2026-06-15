<?php

namespace App\Http\Requests\Catalog;

use App\Models\Service;
use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateServiceRequest extends FormRequest
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
            'category_id' => ['sometimes', 'required', 'integer', 'exists:categories,id'],
            'area_id' => ['sometimes', 'required', 'integer', 'exists:areas,id'],
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'aliases' => ['nullable', 'string', 'max:1000'],
            'price' => ['sometimes', 'required', 'decimal:0,2', 'min:0'],
            'price_change_reason' => ['nullable', 'string', 'max:500'],
            'scan_code' => ['nullable', 'string', 'max:120', Rule::unique('services', 'scan_code')->ignore($this->route('service'))],
            'barcode' => ['nullable', 'string', 'max:120', Rule::unique('services', 'barcode')->ignore($this->route('service'))],
            'qr_code' => ['nullable', 'string', 'max:120', Rule::unique('services', 'qr_code')->ignore($this->route('service'))],
            'description' => ['nullable', 'string', 'max:255'],
            'internal_code' => ['nullable', 'string', 'max:80', Rule::unique('services', 'internal_code')->ignore($this->route('service'))],
            'taxable' => ['sometimes', 'boolean'],
            'active' => ['sometimes', 'boolean'],
            'visible_in_billing' => ['sometimes', 'boolean'],
            'is_billable' => ['sometimes', 'boolean'],
            'special_rule_code' => ['nullable', 'string', Rule::in([Service::ERYTHROPOIETIN_RULE])],
            'print_on_receipt' => ['sometimes', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                /** @var Service|null $service */
                $service = $this->route('service');

                if ($service === null) {
                    return;
                }

                if ($this->filled('category_id') || $this->filled('name') || $this->has('area_id')) {
                    $categoryId = $this->filled('category_id')
                        ? $this->integer('category_id')
                        : $service->category_id;
                    $areaId = $this->has('area_id')
                        ? ($this->input('area_id') === null ? null : $this->integer('area_id'))
                        : $service->area_id;
                    $name = $this->filled('name') ? $this->string('name')->toString() : $service->name;

                    $exists = Service::query()
                        ->where('category_id', $categoryId)
                        ->where(function (Builder $query) use ($areaId): void {
                            $areaId === null
                                ? $query->whereNull('area_id')
                                : $query->where('area_id', $areaId);
                        })
                        ->where('slug', Str::slug($name))
                        ->whereKeyNot($service->id)
                        ->exists();

                    if ($exists) {
                        $validator->errors()->add('name', 'Ya existe un servicio con un nombre equivalente en esta categoria y area.');
                    }
                }

                if (
                    ! $validator->errors()->has('price')
                    && $this->filled('price')
                    && $this->priceChanged($service)
                    && ! $this->filled('price_change_reason')
                ) {
                    $validator->errors()->add('price_change_reason', 'Indique el motivo del cambio de precio.');
                }

                $this->validateGlobalCodes($validator, $service);
            },
        ];
    }

    private function priceChanged(Service $service): bool
    {
        return Money::parseCents($this->string('price')->toString(), 'price')
            !== Money::parseCents((string) $service->price, 'current_price');
    }

    private function validateGlobalCodes(Validator $validator, Service $service): void
    {
        $codes = collect(['scan_code', 'barcode', 'qr_code'])
            ->mapWithKeys(fn (string $field): array => [
                $field => trim((string) ($this->has($field) ? $this->input($field, '') : $service->{$field})),
            ])
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
                ->whereKeyNot($service->id)
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
