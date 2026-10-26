<?php

namespace App\Http\Requests\Cash;

use Illuminate\Foundation\Http\FormRequest;

class CashSessionOptionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->canAny(['cash.view', 'reports.managerial.view', 'reports.cash_session.view']) === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'kind' => ['required', 'in:sessions,cashiers,registers'],
            'search' => ['sometimes', 'string', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'selected_id' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /** @return array{kind: string, search?: string, page?: int|string, per_page?: int|string, selected_id?: int|string} */
    public function filters(): array
    {
        $filters = ['kind' => $this->string('kind')->toString()];
        if ($this->filled('search')) {
            $filters['search'] = $this->string('search')->toString();
        }
        foreach (['page', 'per_page', 'selected_id'] as $key) {
            if ($this->filled($key)) {
                $filters[$key] = $this->integer($key);
            }
        }

        return $filters;
    }
}
