<?php

namespace App\Http\Requests\Fiscal;

use App\Models\FiscalSetting;
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
            'phone' => ['nullable', 'string', 'max:64'],
            'slogan' => ['nullable', 'string', 'max:255'],
            'scanner_enabled' => ['prohibited'],
            'partial_payments_enabled' => ['prohibited'],
            'receipt_template_mode' => ['sometimes', 'string', 'in:institutional'],
            'receipt_paper_size' => ['prohibited'],
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

            $reason = $this->string('reason')->trim()->toString();

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
        $reason = $this->string('reason')->trim()->toString();

        return $reason === '' ? null : $reason;
    }

    private function sensitiveFiscalDataChanged(): bool
    {
        $setting = FiscalSetting::query()->first();

        if ($setting === null) {
            return false;
        }

        $taxRate = $this->normalizedDecimalInput('default_tax_rate');
        if ($this->has('default_tax_rate')
            && $taxRate !== null
            && number_format((float) $setting->default_tax_rate, 2, '.', '') !== $taxRate
        ) {
            return true;
        }

        $rtn = $this->input('rtn');

        return $this->has('rtn') && is_string($rtn) && trim($setting->rtn) !== trim($rtn);
    }

    private function normalizedDecimalInput(string $field): ?string
    {
        $value = $this->input($field);
        if ((! is_int($value) && ! is_float($value) && ! is_string($value)) || ! is_numeric($value)) {
            return null;
        }

        return number_format((float) $value, 2, '.', '');
    }
}
