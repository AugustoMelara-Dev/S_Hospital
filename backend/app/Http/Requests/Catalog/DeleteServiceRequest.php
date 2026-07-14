<?php

namespace App\Http\Requests\Catalog;

use App\Models\InvoiceItem;
use App\Models\Service;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class DeleteServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('delete', $this->route('service')) === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'availability_change_reason' => ['nullable', 'string', 'min:5', 'max:500'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $service = $this->route('service');

                if (! $service instanceof Service) {
                    return;
                }

                if (InvoiceItem::query()->where('service_id', $service->id)->exists()) {
                    return;
                }

                if (! $this->filled('availability_change_reason')) {
                    $validator->errors()->add('availability_change_reason', 'Indique el motivo del cambio de disponibilidad para caja.');
                }
            },
        ];
    }
}
