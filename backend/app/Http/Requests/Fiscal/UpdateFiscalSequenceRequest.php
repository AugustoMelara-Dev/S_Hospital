<?php

namespace App\Http\Requests\Fiscal;

use App\Models\FiscalSequence;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateFiscalSequenceRequest extends FormRequest
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
            'document_type' => ['sometimes', 'required', 'string', 'max:32', 'in:invoice'],
            'prefix' => ['sometimes', 'required', 'string', 'max:32'],
            'min_number' => ['sometimes', 'required', 'integer', 'min:1'],
            'max_number' => ['sometimes', 'required', 'integer'],
            'current_number' => ['sometimes', 'required', 'integer', 'min:0'],
            'cai' => ['sometimes', 'required', 'string', 'max:128'],
            'valid_until' => ['sometimes', 'required', 'date', 'after_or_equal:today'],
            'active' => ['sometimes', 'required', 'boolean'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $sequence = $this->route('fiscalSequence');
                $min = (int) ($this->input('min_number', $sequence->min_number));
                $max = (int) ($this->input('max_number', $sequence->max_number));
                $current = (int) ($this->input('current_number', $sequence->current_number));
                $next = $current + 1;
                $documentType = $this->input('document_type', $sequence->document_type);
                $active = $this->boolean('active', $sequence->active);

                if ($max < $min) {
                    $validator->errors()->add('max_number', 'El numero maximo debe ser mayor o igual al minimo.');
                }

                if ($next < $min || $next > $max) {
                    $validator->errors()->add('current_number', 'El siguiente correlativo debe quedar dentro del rango autorizado.');
                }

                if ($current < $sequence->current_number) {
                    $validator->errors()->add('current_number', 'No se puede reducir el correlativo actual.');
                }

                if ($active && FiscalSequence::query()
                    ->where('document_type', $documentType)
                    ->where('active', true)
                    ->whereKeyNot($sequence->id)
                    ->exists()) {
                    $validator->errors()->add('active', 'Ya existe una secuencia fiscal activa para este tipo de documento.');
                }
            },
        ];
    }
}
