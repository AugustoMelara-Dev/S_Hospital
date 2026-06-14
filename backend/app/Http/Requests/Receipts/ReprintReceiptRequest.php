<?php

namespace App\Http\Requests\Receipts;

use App\Models\Invoice;
use App\Support\InvoiceAccess;
use App\Support\ReceiptPaperSize;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReprintReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $invoice = $this->route('invoice');

        if (! $user || ! $invoice instanceof Invoice || ! $user->can('receipts.reprint')) {
            return false;
        }

        if ($user->can('receipts.reprint_any')) {
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
        return [
            'width' => ['required', Rule::in(ReceiptPaperSize::values())],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ];
    }

    public function width(): string
    {
        return ReceiptPaperSize::normalize((string) $this->validated('width'));
    }

    public function reason(): ?string
    {
        $reason = $this->validated('reason') ?? null;

        return is_string($reason) && trim($reason) !== '' ? trim($reason) : null;
    }
}
