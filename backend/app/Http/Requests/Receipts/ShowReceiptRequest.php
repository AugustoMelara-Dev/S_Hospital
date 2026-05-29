<?php

namespace App\Http\Requests\Receipts;

use App\Models\FiscalSetting;
use App\Models\Invoice;
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
            'width' => ['sometimes', Rule::in(['letter', 'half_letter', 'a5'])],
        ];
    }

    public function width(): string
    {
        if ($this->filled('width')) {
            return (string) $this->input('width');
        }

        $configured = FiscalSetting::query()->latest('id')->value('receipt_paper_size');

        return in_array($configured, ['letter', 'half_letter', 'a5'], true)
            ? $configured
            : 'half_letter';
    }
}
