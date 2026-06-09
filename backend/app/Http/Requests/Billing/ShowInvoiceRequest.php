<?php

namespace App\Http\Requests\Billing;

use App\Models\Invoice;
use App\Support\InvoiceAccess;
use Illuminate\Foundation\Http\FormRequest;

class ShowInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        if ($this->user()?->can('invoices.view') !== true) {
            return false;
        }

        $invoice = $this->route('invoice');

        if (! $invoice instanceof Invoice) {
            return false;
        }

        if (app(InvoiceAccess::class)->canAccessAnyInvoice($this->user())) {
            return true;
        }

        return $invoice->issued_by === $this->user()?->id
            && app(InvoiceAccess::class)->wasIssuedDuringCurrentOperationalDay($invoice);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
