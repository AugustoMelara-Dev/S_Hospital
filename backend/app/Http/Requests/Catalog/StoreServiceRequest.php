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
            'price' => ['required', 'decimal:0,2', 'min:0'],
            'scan_code' => ['nullable', 'string', 'max:120', 'unique:services,scan_code'],
            'barcode' => ['nullable', 'string', 'max:120', 'unique:services,barcode'],
            'qr_code' => ['nullable', 'string', 'max:120', 'unique:services,qr_code'],
            'taxable' => ['sometimes', 'boolean'],
            'active' => ['sometimes', 'boolean'],
            'special_rule_code' => ['nullable', 'string', Rule::in([Service::ERYTHROPOIETIN_RULE])],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if (! $this->filled('category_id') || ! $this->filled('name')) {
                    return;
                }

                $exists = Service::query()
                    ->where('category_id', $this->integer('category_id'))
                    ->where('slug', Str::slug($this->string('name')))
                    ->exists();

                if ($exists) {
                    $validator->errors()->add('name', 'Ya existe un servicio con un nombre equivalente en esta categoria.');
                }
            },
        ];
    }
}
