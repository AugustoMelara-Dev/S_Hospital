<?php

namespace App\Http\Requests\Fiscal;

use App\Models\FiscalSequence;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreFiscalSequenceRequest extends FormRequest
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
            'document_type' => ['required', 'string', 'max:32', 'in:invoice'],
            'prefix' => ['required', 'string', 'max:32'],
            'min_number' => ['required', 'integer', 'min:1'],
            'max_number' => ['required', 'integer', 'gte:min_number'],
            'current_number' => ['required', 'integer', 'min:0', 'lt:max_number'],
            'cai' => ['required', 'string', 'max:128'],
            'valid_until' => ['required', 'date', 'after_or_equal:today'],
            'active' => ['required', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $min = (int) $this->input('min_number');
                $max = (int) $this->input('max_number');
                $current = (int) $this->input('current_number');
                $next = $current + 1;

                if ($max < $min) {
                    $validator->errors()->add('max_number', 'El numero maximo debe ser mayor o igual al minimo.');
                }

                if ($next < $min || $next > $max) {
                    $validator->errors()->add('current_number', 'El siguiente correlativo debe quedar dentro del rango autorizado.');
                }

                if ($this->boolean('active') && FiscalSequence::query()
                    ->where('document_type', $this->input('document_type'))
                    ->where('active', true)
                    ->exists()) {
                    $validator->errors()->add('active', 'Ya existe una secuencia fiscal activa para este tipo de documento.');
                }

                $prefix = $this->input('prefix');
                if ($prefix && ! $validator->errors()->has('min_number') && ! $validator->errors()->has('max_number')) {
                    $overlaps = FiscalSequence::query()
                        ->where('prefix', $prefix)
                        ->where(function ($query) use ($min, $max) {
                            $query->where('min_number', '<=', $max)
                                ->where('max_number', '>=', $min);
                        })
                        ->exists();

                    if ($overlaps) {
                        $validator->errors()->add('min_number', 'El rango de la secuencia se superpone con otra secuencia existente con el mismo prefijo.');
                    }
                }
            },
        ];
    }
}
