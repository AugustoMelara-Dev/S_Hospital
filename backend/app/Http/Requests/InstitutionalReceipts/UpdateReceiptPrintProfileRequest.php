<?php

namespace App\Http\Requests\InstitutionalReceipts;

use App\Models\ReceiptPrintProfile;
use App\Models\ReceiptProfileAssignment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateReceiptPrintProfileRequest extends FormRequest
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
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'paper_kind' => ['sometimes', 'required', Rule::in([
                'custom_mm',
                'half_letter_landscape',
                'a5_landscape',
                'letter_landscape',
                'thermal_80mm',
                'thermal_58mm',
            ])],
            'width_mm' => ['sometimes', 'required', 'numeric', 'min:1', 'max:500', 'decimal:0,2'],
            'height_mm' => ['sometimes', 'required', 'numeric', 'min:1', 'max:500', 'decimal:0,2'],
            'margin_top_mm' => ['sometimes', 'required', 'numeric', 'min:0', 'max:50', 'decimal:0,2'],
            'margin_right_mm' => ['sometimes', 'required', 'numeric', 'min:0', 'max:50', 'decimal:0,2'],
            'margin_bottom_mm' => ['sometimes', 'required', 'numeric', 'min:0', 'max:50', 'decimal:0,2'],
            'margin_left_mm' => ['sometimes', 'required', 'numeric', 'min:0', 'max:50', 'decimal:0,2'],
            'orientation' => ['sometimes', 'required', Rule::in(['landscape', 'portrait'])],
            'template_code' => ['sometimes', 'required', 'string', 'max:80', Rule::in(['institutional_classic'])],
            'font_family' => ['nullable', 'string', 'max:120'],
            'font_scale' => ['sometimes', 'required', 'numeric', 'min:0.70', 'max:1.30', 'decimal:0,2'],
            'copies_mode' => ['sometimes', 'required', Rule::in(['original_only', 'original_first', 'original_first_second'])],
            'show_copy_legend' => ['sometimes', 'required', 'boolean'],
            'show_physical_seal_space' => ['sometimes', 'required', 'boolean'],
            'use_logo' => ['sometimes', 'required', 'boolean'],
            'show_technical_fields' => ['sometimes', 'required', 'boolean'],
            'active' => ['sometimes', 'required', 'boolean'],
            'is_global_default' => ['sometimes', 'required', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                /** @var ReceiptPrintProfile $profile */
                $profile = $this->route('profile');
                $paperKind = (string) $this->input('paper_kind', $profile->paper_kind);
                $width = (float) $this->input('width_mm', $profile->width_mm);
                $height = (float) $this->input('height_mm', $profile->height_mm);
                $active = $this->boolean('active', $profile->active);
                $isGlobalDefault = $this->boolean('is_global_default', $profile->is_global_default);

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
