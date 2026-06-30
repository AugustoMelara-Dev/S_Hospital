<?php

namespace App\Http\Requests\Fiscal;

use App\Models\FiscalSequence;
use App\Models\Invoice;
use App\Support\AuditLogger;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Validator;

class UpdateFiscalSequenceRequest extends FormRequest
{
    public const CRITICAL_FIELDS = [
        'prefix',
        'min_number',
        'max_number',
        'current_number',
        'cai',
        'valid_until',
    ];

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
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function requiresReason(): bool
    {
        if (! $this->user()) {
            return false;
        }
        if ($this->user()->can('fiscal.sequences.reset')) {
            return false;
        }
        $payload = $this->all();
        foreach (self::CRITICAL_FIELDS as $field) {
            if (array_key_exists($field, $payload)) {
                return true;
            }
        }
        return false;
    }

    public function authorizeReason(): void
    {
        if (! $this->requiresReason()) {
            return;
        }

        $reason = trim((string) ($this->input('reason') ?? ''));
        if ($reason === '') {
            throw new HttpResponseException(new JsonResponse([
                'message' => 'Indique el motivo del cambio fiscal.',
                'errors' => [
                    'reason' => ['Los cambios de prefijo, rango, correlativo, CAI o vigencia requieren motivo documentado (permiso fiscal.sequences.reset o motivo obligatorio).'],
                ],
            ], 422));
        }

        if (mb_strlen($reason) < 5) {
            throw new HttpResponseException(new JsonResponse([
                'message' => 'Motivo demasiado corto.',
                'errors' => [
                    'reason' => ['Indique al menos 5 caracteres explicando el motivo del cambio fiscal.'],
                ],
            ], 422));
        }
    }

    public function prepareForValidation(): void
    {
        $this->authorizeReason();
    }

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

                $issuedCount = Invoice::query()->where('fiscal_sequence_id', $sequence->id)->count();
                $maxIssued = $issuedCount > 0 ? ($sequence->min_number + $issuedCount - 1) : 0;

                if ($current < $sequence->current_number || ($maxIssued > 0 && $current < $maxIssued)) {
                    $validator->errors()->add('current_number', 'No se puede reducir el correlativo actual por debajo de los documentos ya emitidos.');
                }

                if ($active && FiscalSequence::query()
                    ->where('document_type', $documentType)
                    ->where('active', true)
                    ->whereKeyNot($sequence->id)
                    ->exists()) {
                    $validator->errors()->add('active', 'Ya existe una secuencia fiscal activa para este tipo de documento.');
                }

                $prefix = $this->input('prefix', $sequence->prefix);
                if ($prefix && ! $validator->errors()->has('min_number') && ! $validator->errors()->has('max_number')) {
                    $overlaps = FiscalSequence::query()
                        ->where('prefix', $prefix)
                        ->whereKeyNot($sequence->id)
                        ->where(function ($query) use ($min, $max) {
                            $query->where('min_number', '<=', $max)
                                ->where('max_number', '>=', $min);
                        })
                        ->exists();

                    if ($overlaps) {
                        $validator->errors()->add('min_number', 'El rango de la secuencia se superpone con otra secuencia existente con el mismo prefijo.');
                    }
                }

                if (! $validator->errors()->isEmpty()) {
                    return;
                }

                if ($this->requiresReason()) {
                    AuditLogger::log(
                        action: 'fiscal_sequence.changed_with_reason',
                        entity: $sequence,
                        request: $this,
                        oldValues: ['current' => $sequence->only(self::CRITICAL_FIELDS)],
                        newValues: ['current' => array_intersect_key($this->validated(), array_flip(self::CRITICAL_FIELDS))],
                        reason: (string) $this->input('reason'),
                    );
                }
            },
        ];
    }
}
