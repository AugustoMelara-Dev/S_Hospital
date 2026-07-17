<?php

namespace App\Http\Requests\Receipts;

use App\Models\Invoice;
use App\Support\InvoiceAccess;
use App\Support\ReceiptPaperSize;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ShowReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $invoice = $this->route('invoice');

        if (! $user || ! $invoice instanceof Invoice || ! $user->can('receipts.view')) {
            return false;
        }

        if ($user->can('receipts.reprint_any')) {
            return true;
        }

        return $invoice->issued_by === $user->id
            && app(InvoiceAccess::class)->wasIssuedDuringCurrentOperationalDay($invoice);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'width' => ['sometimes', Rule::in(ReceiptPaperSize::values())],
        ];
    }

    public function width(): string
    {
        if ($this->filled('width')) {
            return ReceiptPaperSize::normalize((string) $this->input('width'));
        }

        $invoice = $this->route('invoice');
        $paperSize = $invoice instanceof Invoice ? (string) ($invoice->receipt_paper_size ?? '') : '';

        return ReceiptPaperSize::normalize($paperSize);
    }
}
