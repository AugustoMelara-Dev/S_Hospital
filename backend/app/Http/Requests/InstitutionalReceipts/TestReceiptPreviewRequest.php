<?php

namespace App\Http\Requests\InstitutionalReceipts;

use App\Models\ReceiptPrintProfile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TestReceiptPreviewRequest extends FormRequest
{
    /**
     * Draft-only fields that change paper geometry / typography. They require the
     * same `receipt_settings.advanced` permission as the real profile update, so
     * the preview cannot be used to probe support-only paper settings.
     */
    public const ADVANCED_DRAFT_FIELDS = [
        'paper_kind',
        'orientation',
        'width_mm',
        'height_mm',
        'margin_top_mm',
        'margin_right_mm',
        'margin_bottom_mm',
        'margin_left_mm',
        'font_family',
        'font_scale',
        'show_technical_fields',
    ];

    public function authorize(): bool
    {
        $user = $this->user();

        return $user?->can('receipts.print_test') === true
            || $user?->can('receipt_settings.update') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = [
            'profile_id' => ['nullable', 'integer', 'exists:receipt_print_profiles,id'],
            'profile_code' => ['nullable', 'string', 'exists:receipt_print_profiles,code'],
            'payer_name' => ['sometimes', 'required', 'string', 'max:180'],
            'concept' => ['sometimes', 'required', 'string', 'max:500'],
            'amount' => ['sometimes', 'required', 'numeric', 'min:0', 'max:9999999999.99', 'decimal:0,2'],

            // Optional unsaved form state. The engine renders it exactly like the
            // real draft PDF: nothing is persisted and no correlativo is consumed.
            'draft' => ['sometimes', 'array'],
            'draft.copies_mode' => ['sometimes', 'required', Rule::in(['original_only', 'original_first', 'original_first_second'])],
            'draft.show_copy_legend' => ['sometimes', 'required', 'boolean'],
            'draft.show_physical_seal_space' => ['sometimes', 'required', 'boolean'],
            'draft.use_logo' => ['sometimes', 'required', 'boolean'],
            'draft.active' => ['sometimes', 'required', 'boolean'],
            'draft.is_global_default' => ['sometimes', 'required', 'boolean'],
        ];

        if ($this->user()?->can('receipt_settings.advanced') === true) {
            $rules['draft.paper_kind'] = ['sometimes', 'required', Rule::in([
                'custom_mm',
                'half_letter_landscape',
                'a5_landscape',
                'letter_landscape',
                'letter_portrait',
                'a4_portrait',
                'thermal_80mm',
                'thermal_58mm',
            ])];
            $rules['draft.orientation'] = ['sometimes', 'required', Rule::in(['landscape', 'portrait'])];
            $rules['draft.width_mm'] = ['sometimes', 'required', 'numeric', 'min:1', 'max:500', 'decimal:0,2'];
            $rules['draft.height_mm'] = ['sometimes', 'required', 'numeric', 'min:1', 'max:500', 'decimal:0,2'];
            $rules['draft.margin_top_mm'] = ['sometimes', 'required', 'numeric', 'min:0', 'max:50', 'decimal:0,2'];
            $rules['draft.margin_right_mm'] = ['sometimes', 'required', 'numeric', 'min:0', 'max:50', 'decimal:0,2'];
            $rules['draft.margin_bottom_mm'] = ['sometimes', 'required', 'numeric', 'min:0', 'max:50', 'decimal:0,2'];
            $rules['draft.margin_left_mm'] = ['sometimes', 'required', 'numeric', 'min:0', 'max:50', 'decimal:0,2'];
            $rules['draft.font_family'] = ['nullable', 'string', 'max:120'];
            $rules['draft.font_scale'] = ['sometimes', 'required', 'numeric', 'min:0.70', 'max:1.30', 'decimal:0,2'];
            $rules['draft.show_technical_fields'] = ['sometimes', 'required', 'boolean'];
        }

        return $rules;
    }

    public function hasAdvancedDraftFields(): bool
    {
        $draft = $this->input('draft');

        if (! is_array($draft)) {
            return false;
        }

        foreach (self::ADVANCED_DRAFT_FIELDS as $field) {
            if (array_key_exists($field, $draft)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    public function draftOverrides(): array
    {
        $draft = $this->input('draft');

        if (! is_array($draft)) {
            return [];
        }

        return array_filter(
            $draft,
            static fn (mixed $value, string $key): bool => in_array($key, array_merge(
                self::ADVANCED_DRAFT_FIELDS,
                ['copies_mode', 'show_copy_legend', 'show_physical_seal_space', 'use_logo', 'active', 'is_global_default'],
            ), true),
            ARRAY_FILTER_USE_BOTH,
        );
    }

    /**
     * Applies the unsaved draft over an existing profile in memory. The persisted
     * row is never modified: this only produces the transient profile the engine
     * renders for the preview.
     */
    public function draftProfile(ReceiptPrintProfile $base): ReceiptPrintProfile
    {
        $transient = $base->replicate();

        foreach ($this->draftOverrides() as $field => $value) {
            $transient->setAttribute($field, $value);
        }

        return $transient;
    }
}
