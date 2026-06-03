<?php

declare(strict_types=1);

namespace App\Http\Requests\Catalog;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class UpdateCategoryRequest extends FormRequest
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
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                /** @var Category|null $category */
                $category = $this->route('category');

                if ($category === null || ! $this->filled('name')) {
                    return;
                }

                $exists = Category::query()
                    ->where('slug', Str::slug($this->string('name')))
                    ->whereKeyNot($category->id)
                    ->exists();

                if ($exists) {
                    $validator->errors()->add('name', 'Ya existe una categoria con un nombre equivalente.');
                }
            },
        ];
    }
}
