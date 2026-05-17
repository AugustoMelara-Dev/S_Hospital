<?php

namespace App\Http\Requests\Catalog;

use App\Models\Service;
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
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'price' => ['sometimes', 'required', 'decimal:0,2', 'min:0'],
            'scan_code' => ['nullable', 'string', 'max:120', Rule::unique('services', 'scan_code')->ignore($this->route('service'))],
            'barcode' => ['nullable', 'string', 'max:120', Rule::unique('services', 'barcode')->ignore($this->route('service'))],
            'qr_code' => ['nullable', 'string', 'max:120', Rule::unique('services', 'qr_code')->ignore($this->route('service'))],
            'taxable' => ['sometimes', 'boolean'],
            'active' => ['sometimes', 'boolean'],
            'special_rule_code' => ['nullable', 'string', Rule::in([Service::ERYTHROPOIETIN_RULE])],
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

                $categoryId = $this->filled('category_id')
                    ? $this->integer('category_id')
                    : $service->category_id;
                $name = $this->filled('name') ? $this->string('name')->toString() : $service->name;

                $exists = Service::query()
                    ->where('category_id', $categoryId)
                    ->where('slug', Str::slug($name))
                    ->whereKeyNot($service->id)
                    ->exists();

                if ($exists) {
                    $validator->errors()->add('name', 'Ya existe un servicio con un nombre equivalente en esta categoria.');
                }
            },
        ];
    }
}
