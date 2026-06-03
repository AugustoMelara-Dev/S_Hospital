<?php

declare(strict_types=1);

namespace App\Http\Requests\Fiscal;

use App\Support\ReceiptPaperSize;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateFiscalSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('settings.fiscal.update') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'hospital_name' => ['required', 'string', 'max:255'],
            'rtn' => ['required', 'string', 'max:32'],
            'default_tax_rate' => ['required', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
            'receipt_width' => ['prohibited'],
            'primary_color' => ['required', 'string', 'in:teal,blue,indigo,green,rose'],
            'address' => ['nullable', 'string', 'max:255'],
            'slogan' => ['nullable', 'string', 'max:255'],
            'scanner_enabled' => ['sometimes', 'boolean'],
            'partial_payments_enabled' => ['sometimes', 'boolean'],
            'receipt_template_mode' => ['sometimes', 'string', 'in:institutional'],
            'receipt_paper_size' => ['sometimes', 'string', Rule::in(ReceiptPaperSize::values())],
            'government_line' => ['nullable', 'string', 'max:120'],
            'secretariat_line' => ['nullable', 'string', 'max:160'],
            'receipt_location' => ['nullable', 'string', 'max:160'],
            'receipt_footer_text' => ['nullable', 'string', 'max:255'],
        ];
    }
}
