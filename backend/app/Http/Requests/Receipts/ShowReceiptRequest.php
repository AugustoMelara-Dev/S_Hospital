<?php

namespace App\Http\Requests\Receipts;

use App\Models\Invoice;
use App\Models\FiscalSetting;
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

        if ($user->can('receipts.reprint_any') || $user->can('invoices.void')) {
            return true;
        }

        return $invoice->issued_by === $user->id
            && $invoice->issued_at?->isToday() === true;
    }

    public function rules(): array
    {
        return [
            'width' => ['sometimes', Rule::in(['80mm', '58mm'])],
        ];
    }

    public function width(): string
    {
        if ($this->filled('width')) {
            return (string) $this->input('width');
        }

        return FiscalSetting::query()->latest('id')->value('receipt_width') ?? '80mm';
    }
}
