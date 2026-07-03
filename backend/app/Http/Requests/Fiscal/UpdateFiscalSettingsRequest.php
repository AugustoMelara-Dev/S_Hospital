<?php

namespace App\Http\Requests\Fiscal;

use App\Models\FiscalSetting;
use App\Support\ReceiptPaperSize;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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
        $presenceRule = FiscalSetting::query()->exists() ? 'sometimes' : 'required';

        return [
            'hospital_name' => [$presenceRule, 'string', 'max:255'],
            'rtn' => [$presenceRule, 'string', 'max:32'],
            'default_tax_rate' => [$presenceRule, 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
            'receipt_width' => [
                Rule::prohibitedIf(fn (): bool => $this->input('receipt_template_mode') !== 'institutional'),
                'string',
                'in:80mm,58mm',
            ],
            'primary_color' => [$presenceRule, 'string', 'in:teal,blue,indigo,green,rose'],
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
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $this->sensitiveFiscalDataChanged()) {
                return;
            }

            $reason = trim((string) ($this->input('reason') ?? ''));

            if ($reason === '') {
                $validator->errors()->add('reason', 'Indique el motivo del cambio fiscal.');

                return;
            }

            if (mb_strlen($reason) < 5) {
                $validator->errors()->add('reason', 'Indique al menos 5 caracteres explicando el motivo del cambio fiscal.');
            }
        });
    }

    public function reason(): ?string
    {
        $reason = trim((string) ($this->validated('reason') ?? ''));

        return $reason === '' ? null : $reason;
    }

    private function sensitiveFiscalDataChanged(): bool
    {
        $setting = FiscalSetting::query()->first();

        if ($setting === null) {
            return false;
        }

        if ($this->has('default_tax_rate')
            && number_format((float) $setting->default_tax_rate, 2, '.', '') !== number_format((float) $this->input('default_tax_rate'), 2, '.', '')
        ) {
            return true;
        }

        return $this->has('rtn') && trim($setting->rtn) !== trim((string) $this->input('rtn'));
    }
}
