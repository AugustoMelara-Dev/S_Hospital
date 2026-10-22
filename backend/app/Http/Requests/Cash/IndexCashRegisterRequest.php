<?php

namespace App\Http\Requests\Cash;

use Illuminate\Foundation\Http\FormRequest;

class IndexCashRegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user?->can('cash.view') === true
            || $user?->can('cash.open') === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [];
    }
}
