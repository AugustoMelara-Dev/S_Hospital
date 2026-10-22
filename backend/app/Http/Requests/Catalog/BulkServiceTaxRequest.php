<?php

namespace App\Http\Requests\Catalog;

use App\Models\Service;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * H-15: bulk tax assignment for the catalog.
 *
 * Exactly one target selector is required: a whole category or an explicit
 * list of service ids. `tax_rate_id = null` sets those services exempt. The
 * reason is mandatory because it is a fiscal change that must be auditable.
 */
class BulkServiceTaxRequest extends FormRequest
{
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
            'category_id' => ['required_without:service_ids', 'nullable', 'integer', 'exists:categories,id'],
            'service_ids' => ['required_without:category_id', 'nullable', 'array', 'min:1'],
            'service_ids.*' => ['integer', 'distinct', 'exists:services,id'],
            'tax_rate_id' => ['nullable', 'integer', Rule::exists('tax_rates', 'id')->where('active', true)],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->filled('category_id') && $this->has('service_ids') && $this->input('service_ids') !== null) {
                    $validator->errors()->add('service_ids', 'Indique una categoria o una lista de servicios, no ambas.');
                }
            },
        ];
    }

    /**
     * @return list<int>
     */
    public function serviceIds(): array
    {
        $ids = $this->input('service_ids');

        if (! is_array($ids)) {
            return [];
        }

        return array_values(array_map(
            static fn (mixed $id): int => (int) $id,
            array_filter($ids, static fn (mixed $id): bool => is_int($id) || (is_string($id) && ctype_digit($id))),
        ));
    }

    public function categoryId(): ?int
    {
        if (! $this->filled('category_id')) {
            return null;
        }

        return $this->integer('category_id');
    }

    public function taxRateId(): ?int
    {
        if ($this->input('tax_rate_id') === null || $this->input('tax_rate_id') === '') {
            return null;
        }

        return $this->integer('tax_rate_id');
    }

    public function reason(): string
    {
        return trim($this->string('reason')->toString());
    }
}
