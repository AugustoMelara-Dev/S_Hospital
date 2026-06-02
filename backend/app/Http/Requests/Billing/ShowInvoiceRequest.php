<?php

namespace App\Http\Requests\Billing;

use Illuminate\Foundation\Http\FormRequest;

class ShowInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('invoices.view') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
