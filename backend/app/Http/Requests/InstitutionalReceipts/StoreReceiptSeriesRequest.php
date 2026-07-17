<?php

namespace App\Http\Requests\InstitutionalReceipts;

use App\Models\InstitutionalReceiptSeries;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreReceiptSeriesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('receipt_settings.update') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'document_type' => ['sometimes', 'required', 'string', Rule::in([InstitutionalReceiptSeries::DOCUMENT_TYPE])],
            'series' => ['required', 'string', 'max:32'],
            'prefix' => ['required', 'string', 'max:32'],
            'number_format' => ['sometimes', 'required', 'string', 'max:80'],
            'min_number' => ['required', 'integer', 'min:1'],
            'max_number' => ['required', 'integer', 'gte:min_number'],
            'current_number' => ['required', 'integer', 'min:0'],
            'range_authorization' => ['nullable', 'string', 'max:128'],
            'legal_text' => ['nullable', 'string', 'max:2000'],
            'receipt_number_color' => ['sometimes', 'required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'active' => ['required', 'boolean'],
            'reprint_behavior' => ['sometimes', 'required', Rule::in([
                InstitutionalReceiptSeries::REPRINT_AUDIT_ONLY,
                InstitutionalReceiptSeries::REPRINT_REQUIRE_REASON,
            ])],
            'void_behavior' => ['sometimes', 'required', Rule::in([
                InstitutionalReceiptSeries::VOID_PERMISSION_REASON_AUDIT,
            ])],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $documentType = $this->input('document_type', InstitutionalReceiptSeries::DOCUMENT_TYPE);
                $min = (int) $this->input('min_number');
                $max = (int) $this->input('max_number');
                $current = (int) $this->input('current_number');
                $next = $current + 1;

                if ($this->boolean('active') && ($next < $min || $next > $max)) {
                    $validator->errors()->add('current_number', 'El siguiente correlativo del recibo debe quedar dentro del rango autorizado.');
                }

                if ($this->boolean('active') && InstitutionalReceiptSeries::query()
                    ->where('document_type', $documentType)
                    ->where('active', true)
                    ->exists()) {
                    $validator->errors()->add('active', 'Ya existe una serie activa para recibos institucionales.');
                }
            },
        ];
    }
}
