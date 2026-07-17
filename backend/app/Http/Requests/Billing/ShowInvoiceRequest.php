<?php

namespace App\Http\Requests\Billing;

use App\Models\Invoice;
use App\Models\User;
use App\Support\InvoiceAccess;
use Illuminate\Foundation\Http\FormRequest;

class ShowInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user instanceof User || ! $user->can('invoices.view')) {
            return false;
        }

        $invoice = $this->route('invoice');

        if (! $invoice instanceof Invoice) {
            return false;
        }

        if (app(InvoiceAccess::class)->canAccessAnyInvoice($user)) {
            return true;
        }

        return $invoice->issued_by === $user->id
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
