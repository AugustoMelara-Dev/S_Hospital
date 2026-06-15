<?php

namespace App\Http\Requests\Catalog;

use App\Models\ServiceArea;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class StoreServiceAreaRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:120'],
            'active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if (! $this->filled('name')) {
                    return;
                }

                $exists = ServiceArea::query()
                    ->where('slug', Str::slug($this->string('name')))
                    ->exists();

                if ($exists) {
                    $validator->errors()->add('name', 'Ya existe un area con un nombre equivalente.');
                }
            },
        ];
    }
}
