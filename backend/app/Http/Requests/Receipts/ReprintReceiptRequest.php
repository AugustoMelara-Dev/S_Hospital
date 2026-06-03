<?php

declare(strict_types=1);

namespace App\Http\Requests\Receipts;

use App\Models\Invoice;
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
            && $invoice->issued_at?->isToday() === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'width' => ['required', Rule::in(ReceiptPaperSize::values())],
            'reason' => ['nullable', 'string', 'max:500'],
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
