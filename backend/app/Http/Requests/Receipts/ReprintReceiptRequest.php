<?php

namespace App\Http\Requests\Receipts;

use App\Models\Invoice;
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
            'width' => ['required', Rule::in(['letter', 'half_letter', 'a5'])],
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function width(): string
    {
        return (string) $this->validated('width');
    }

    public function reason(): ?string
    {
        $reason = $this->validated('reason') ?? null;

        return is_string($reason) && trim($reason) !== '' ? trim($reason) : null;
    }
}
