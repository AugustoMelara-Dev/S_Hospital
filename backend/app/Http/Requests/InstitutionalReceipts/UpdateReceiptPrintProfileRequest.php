<?php

namespace App\Http\Requests\InstitutionalReceipts;

use App\Models\ReceiptPrintProfile;
use App\Models\ReceiptProfileAssignment;
use App\Support\AuditLogger;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateReceiptPrintProfileRequest extends FormRequest
{
    /**
     * @var list<string>
     */
    public const ADVANCED_FIELDS = [
        'width_mm',
        'height_mm',
        'margin_top_mm',
        'margin_right_mm',
        'margin_bottom_mm',
        'margin_left_mm',
        'font_family',
        'font_scale',
    ];

    public function authorize(): bool
    {
        if ($this->user()?->can('receipt_settings.update') !== true) {
            return false;
        }

        $payload = $this->all();
        $hasAdvanced = false;
        $present = [];

        foreach (self::ADVANCED_FIELDS as $key) {
            if (array_key_exists($key, $payload)) {
                $hasAdvanced = true;
                $present[] = $key;
            }
        }

        if (! $hasAdvanced) {
            return true;
        }

        if ($this->user()->can('receipt_settings.advanced')) {
            return true;
        }

        $profile = $this->route('profile');

        AuditLogger::log(
            action: 'receipt_settings.advanced_denied',
            entity: ReceiptPrintProfile::class,
            entityId: $profile instanceof ReceiptPrintProfile ? $profile->getKey() : null,
            request: $this,
            newValues: ['attempted_fields' => $present],
            reason: 'Intento de modificar campos avanzados sin permiso.',
            result: 'denied',
        );

        throw new HttpResponseException(new JsonResponse([
            'message' => 'Este cambio requiere el permiso receipt_settings.advanced.',
            'errors' => [
                'receipt_settings.advanced' => [
                    'No tiene permiso para modificar margenes, tamano, fuente o escala del recibo. Solicite soporte tecnico.',
                ],
            ],
        ], 403));
    }

    public function hasAdvancedFields(): bool
    {
        $payload = $this->all();

        foreach (self::ADVANCED_FIELDS as $key) {
            if (array_key_exists($key, $payload)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<string>
     */
    public function advancedFieldsPresent(): array
    {
        $payload = $this->all();
        $present = [];

        foreach (self::ADVANCED_FIELDS as $key) {
            if (array_key_exists($key, $payload)) {
                $present[] = $key;
            }
        }

        return $present;
    }

    public function supportReason(): ?string
    {
        $reason = trim((string) $this->input('support_reason', ''));

        return $reason === '' ? null : $reason;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = [
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'paper_kind' => ['sometimes', 'required', Rule::in([
                'custom_mm',
                'half_letter_landscape',
                'a5_landscape',
                'letter_landscape',
                'thermal_80mm',
                'thermal_58mm',
            ])],
            'orientation' => ['sometimes', 'required', Rule::in(['landscape', 'portrait'])],
            'template_code' => ['sometimes', 'required', 'string', 'max:80', Rule::in(['institutional_classic'])],
            'copies_mode' => ['sometimes', 'required', Rule::in(['original_only', 'original_first', 'original_first_second'])],
            'show_copy_legend' => ['sometimes', 'required', 'boolean'],
            'show_physical_seal_space' => ['sometimes', 'required', 'boolean'],
            'use_logo' => ['sometimes', 'required', 'boolean'],
            'show_technical_fields' => ['sometimes', 'required', 'boolean'],
            'active' => ['sometimes', 'required', 'boolean'],
            'is_global_default' => ['sometimes', 'required', 'boolean'],
            'support_reason' => ['nullable', 'string', 'max:500'],
        ];

        if ($this->user()?->can('receipt_settings.advanced') === true) {
            $rules['width_mm'] = ['sometimes', 'required', 'numeric', 'min:1', 'max:500', 'decimal:0,2'];
            $rules['height_mm'] = ['sometimes', 'required', 'numeric', 'min:1', 'max:500', 'decimal:0,2'];
            $rules['margin_top_mm'] = ['sometimes', 'required', 'numeric', 'min:0', 'max:50', 'decimal:0,2'];
            $rules['margin_right_mm'] = ['sometimes', 'required', 'numeric', 'min:0', 'max:50', 'decimal:0,2'];
            $rules['margin_bottom_mm'] = ['sometimes', 'required', 'numeric', 'min:0', 'max:50', 'decimal:0,2'];
            $rules['margin_left_mm'] = ['sometimes', 'required', 'numeric', 'min:0', 'max:50', 'decimal:0,2'];
            $rules['font_family'] = ['nullable', 'string', 'max:120'];
            $rules['font_scale'] = ['sometimes', 'required', 'numeric', 'min:0.70', 'max:1.30', 'decimal:0,2'];
        }

        return $rules;
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                /** @var ReceiptPrintProfile $profile */
                $profile = $this->route('profile');
                $paperKind = (string) $this->input('paper_kind', $profile->paper_kind);
                $active = $this->boolean('active', $profile->active);
                $isGlobalDefault = $this->boolean('is_global_default', $profile->is_global_default);

                $userHasAdvanced = $this->user()?->can('receipt_settings.advanced') === true;

                if ($userHasAdvanced && $this->hasAdvancedFields()) {
                    $supportReason = trim((string) $this->input('support_reason', ''));

                    if ($supportReason === '') {
                        $validator->errors()->add('support_reason', 'Indique el motivo del ajuste avanzado de impresion.');
                    } elseif (mb_strlen($supportReason) < 5) {
                        $validator->errors()->add('support_reason', 'Indique al menos 5 caracteres explicando el ajuste avanzado de impresion.');
                    }
                }

                if ($userHasAdvanced) {
                    $width = (float) $this->input('width_mm', $profile->width_mm);
                    $height = (float) $this->input('height_mm', $profile->height_mm);

                    if ($paperKind === 'custom_mm') {
                        if ($width < 80 || $width > 300) {
                            $validator->errors()->add('width_mm', 'El ancho personalizado debe estar entre 80 mm y 300 mm.');
                        }

                        if ($height < 50 || $height > 220) {
                            $validator->errors()->add('height_mm', 'El alto personalizado debe estar entre 50 mm y 220 mm.');
                        }
                    }

                    $fixedDimensions = [
                        'half_letter_landscape' => ['width' => 215.90, 'height' => 139.70],
                        'a5_landscape' => ['width' => 210.00, 'height' => 148.00],
                        'letter_landscape' => ['width' => 279.40, 'height' => 215.90],
                    ];

                    if (isset($fixedDimensions[$paperKind])) {
                        $expected = $fixedDimensions[$paperKind];

                        if (abs($width - $expected['width']) > 0.01) {
                            $validator->errors()->add('width_mm', 'El ancho de este perfil estandar debe coincidir con el tamano real del papel.');
                        }

                        if (abs($height - $expected['height']) > 0.01) {
                            $validator->errors()->add('height_mm', 'El alto de este perfil estandar debe coincidir con el tamano real del papel.');
                        }
                    }
                }

                if ($isGlobalDefault && in_array($paperKind, ['thermal_80mm', 'thermal_58mm'], true)) {
                    $validator->errors()->add('is_global_default', 'Un perfil termico no puede ser el predeterminado institucional.');
                }

                if (! $active && ReceiptProfileAssignment::query()
                    ->where('receipt_print_profile_id', $profile->id)
                    ->where('active', true)
                    ->exists()) {
                    $validator->errors()->add('active', 'No se puede desactivar un perfil asignado activamente a una caja o usuario.');
                }
            },
        ];
    }
}
