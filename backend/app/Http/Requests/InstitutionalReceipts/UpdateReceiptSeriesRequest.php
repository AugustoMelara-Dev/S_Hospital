<?php

namespace App\Http\Requests\InstitutionalReceipts;

use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateReceiptSeriesRequest extends FormRequest
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
            'series' => ['sometimes', 'required', 'string', 'max:32'],
            'prefix' => ['sometimes', 'required', 'string', 'max:32'],
            'number_format' => ['sometimes', 'required', 'string', 'max:80'],
            'min_number' => ['sometimes', 'required', 'integer', 'min:1'],
            'max_number' => ['sometimes', 'required', 'integer'],
            'current_number' => ['sometimes', 'required', 'integer', 'min:0'],
            'range_authorization' => ['nullable', 'string', 'max:128'],
            'legal_text' => ['nullable', 'string', 'max:2000'],
            'receipt_number_color' => ['sometimes', 'required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'active' => ['sometimes', 'required', 'boolean'],
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
                /** @var InstitutionalReceiptSeries $series */
                $series = $this->route('series');
                $documentType = $this->input('document_type', $series->document_type);
                $min = $this->integer('min_number', $series->min_number);
                $max = $this->integer('max_number', $series->max_number);
                $current = $this->integer('current_number', $series->current_number);
                $active = $this->boolean('active', $series->active);
                $next = $current + 1;

                if ($max < $min) {
                    $validator->errors()->add('max_number', 'El numero maximo debe ser mayor o igual al minimo.');
                }

                if ($active && ($next < $min || $next > $max)) {
                    $validator->errors()->add('current_number', 'El siguiente correlativo del recibo debe quedar dentro del rango autorizado.');
                }

                $maxIssuedValue = InstitutionalReceipt::query()
                    ->where('series_id', $series->id)
                    ->max('receipt_number');
                $validatedMaxIssued = filter_var($maxIssuedValue, FILTER_VALIDATE_INT);
                $maxIssued = is_int($validatedMaxIssued) ? $validatedMaxIssued : 0;
                $minimumSafeCurrentNumber = max($series->current_number, $maxIssued);

                if ($this->has('current_number') && $current < $minimumSafeCurrentNumber) {
                    $validator->errors()->add('current_number', 'No se puede reducir el correlativo actual por debajo de recibos ya emitidos.');
                }

                if ($active && InstitutionalReceiptSeries::query()
                    ->where('document_type', $documentType)
                    ->where('active', true)
                    ->whereKeyNot($series->id)
                    ->exists()) {
                    $validator->errors()->add('active', 'Ya existe una serie activa para recibos institucionales.');
                }
            },
        ];
    }
}
