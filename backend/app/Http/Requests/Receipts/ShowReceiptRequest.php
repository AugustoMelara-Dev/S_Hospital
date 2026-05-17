<?php

namespace App\Http\Requests\Receipts;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ShowReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('receipts.view') === true;
    }

    public function rules(): array
    {
        return [
            'width' => ['sometimes', Rule::in(['80mm', '58mm'])],
        ];
    }

    public function width(): string
    {
        return (string) $this->input('width', '80mm');
    }
}
