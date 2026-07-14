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
        return $this->user()?->can('update', $this->route('service')) === true;
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
            'price' => ['sometimes', 'required', 'decimal:0,2', 'gt:0'],
            'price_change_reason' => ['nullable', 'string', 'min:5', 'max:500'],
            'tax_change_reason' => ['nullable', 'string', 'min:5', 'max:500'],
            'availability_change_reason' => ['nullable', 'string', 'min:5', 'max:500'],
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

                if (
                    ! $validator->errors()->has('taxable')
                    && $this->has('taxable')
                    && $this->taxChanged($service)
                    && ! $this->filled('tax_change_reason')
                ) {
                    $validator->errors()->add('tax_change_reason', 'Indique el motivo del cambio de impuesto.');
                }

                if (
                    ! $validator->errors()->has('availability_change_reason')
                    && $this->availabilityChanged($service)
                    && ! $this->filled('availability_change_reason')
                ) {
                    $validator->errors()->add('availability_change_reason', 'Indique el motivo del cambio de disponibilidad para caja.');
                }

                $this->validateErythropoietinRuleIntegrity($validator, $service);
                $this->validateErythropoietinFixedPrice($validator, $service);
                $this->validateGlobalCodes($validator, $service);
            },
        ];
    }

    private function validateErythropoietinRuleIntegrity(Validator $validator, Service $service): void
    {
        $serviceHasRule = $service->special_rule_code === Service::ERYTHROPOIETIN_RULE;
        $requestedRule = $this->requestedSpecialRuleCode($service);
        $usesRule = $serviceHasRule || $requestedRule === Service::ERYTHROPOIETIN_RULE;

        if ($serviceHasRule && $requestedRule !== Service::ERYTHROPOIETIN_RULE) {
            $validator->errors()->add('special_rule_code', 'No se puede retirar la regla de Eritropoyetina.');
        }

        $requestedTaxable = $this->has('taxable')
            ? $this->boolean('taxable')
            : (bool) $service->taxable;

        if ($usesRule && $requestedTaxable) {
            $validator->errors()->add('taxable', 'Eritropoyetina debe mantenerse sin impuesto.');
        }
    }

    private function validateErythropoietinFixedPrice(Validator $validator, Service $service): void
    {
        if ($validator->errors()->has('price')) {
            return;
        }

        $specialRuleCode = $service->special_rule_code === Service::ERYTHROPOIETIN_RULE
            ? Service::ERYTHROPOIETIN_RULE
            : $this->requestedSpecialRuleCode($service);

        if ($specialRuleCode !== Service::ERYTHROPOIETIN_RULE) {
            return;
        }

        $price = $this->has('price')
            ? $this->string('price')->toString()
            : (string) $service->price;

        if (Money::parseCents($price, 'price') !== self::ERYTHROPOIETIN_PRICE_CENTS) {
            $validator->errors()->add('price', 'Eritropoyetina debe mantener precio fijo de L.25.00.');
        }
    }

    private function requestedSpecialRuleCode(Service $service): ?string
    {
        return $this->has('special_rule_code')
            ? $this->input('special_rule_code')
            : $service->special_rule_code;
    }

    private function priceChanged(Service $service): bool
    {
        return Money::parseCents($this->string('price')->toString(), 'price')
            !== Money::parseCents((string) $service->price, 'current_price');
    }

    private function taxChanged(Service $service): bool
    {
        return $this->boolean('taxable') !== (bool) $service->taxable;
    }

    private function availabilityChanged(Service $service): bool
    {
        return ($this->has('active') && $this->boolean('active') !== (bool) $service->active)
            || ($this->has('visible_in_billing') && $this->boolean('visible_in_billing') !== (bool) $service->visible_in_billing)
            || ($this->has('is_billable') && $this->boolean('is_billable') !== (bool) $service->is_billable);
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
