<?php

namespace App\Http\Requests\InstitutionalReceipts;

use App\Models\ReceiptPrintProfile;
use App\Models\ReceiptProfileAssignment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpsertReceiptProfileAssignmentRequest extends FormRequest
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
            'profile_id' => ['required_without:profile_code', 'integer', 'exists:receipt_print_profiles,id'],
            'profile_code' => ['required_without:profile_id', 'string', 'exists:receipt_print_profiles,code'],
            'scope_type' => ['required', Rule::in([
                ReceiptProfileAssignment::SCOPE_GLOBAL,
                ReceiptProfileAssignment::SCOPE_USER,
                ReceiptProfileAssignment::SCOPE_CASH_SESSION,
            ])],
            'scope_id' => ['nullable', 'integer', 'min:1'],
            'active' => ['sometimes', 'required', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $scopeType = $this->input('scope_type');
                $scopeId = $this->input('scope_id');

                if ($scopeType === ReceiptProfileAssignment::SCOPE_GLOBAL && $scopeId !== null) {
                    $validator->errors()->add('scope_id', 'La asignacion global no debe tener identificador de alcance.');
                }

                if ($scopeType !== ReceiptProfileAssignment::SCOPE_GLOBAL && $scopeId === null) {
                    $validator->errors()->add('scope_id', 'El identificador de alcance es obligatorio para esta asignacion.');
                }

                if (! $this->boolean('active', true)) {
                    return;
                }

                $profile = $this->input('profile_id') !== null
                    ? ReceiptPrintProfile::query()->find($this->input('profile_id'))
                    : ReceiptPrintProfile::query()->where('code', $this->input('profile_code'))->first();

                if ($profile instanceof ReceiptPrintProfile && ! $profile->active) {
                    $validator->errors()->add('profile_id', 'No se puede activar una asignacion con un perfil de impresion inactivo.');
                }
            },
        ];
    }
}
