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

class UpsertReceiptProfileAssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        if ($this->user()?->can('receipt_settings.update') !== true) {
            return false;
        }

        if (! $this->boolean('active', true) || $this->user()->can('receipt_settings.advanced')) {
            return true;
        }

        $profile = $this->profileFromPayload();
        if (! $profile?->isSupportOnly()) {
            return true;
        }

        AuditLogger::log(
            action: 'receipt_settings.advanced_denied',
            entity: $profile,
            request: $this,
            newValues: [
                'attempted_fields' => ['profile_code'],
                'profile_code' => $profile->code,
                'flow' => 'profile-assignment',
            ],
            reason: 'Intento de asignar perfil de soporte sin permiso avanzado.',
            result: 'failed',
        );

        throw new HttpResponseException(new JsonResponse([
            'message' => 'Este perfil requiere el permiso receipt_settings.advanced.',
            'errors' => [
                'receipt_settings.advanced' => [
                    'Los perfiles de soporte tecnico solo pueden asignarse con permiso receipt_settings.advanced.',
                ],
            ],
        ], 403));
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

    /** @return list<callable(Validator): void> */
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

    private function profileFromPayload(): ?ReceiptPrintProfile
    {
        if ($this->input('profile_id') !== null) {
            return ReceiptPrintProfile::query()->find($this->input('profile_id'));
        }

        if ($this->input('profile_code') !== null) {
            return ReceiptPrintProfile::query()->where('code', $this->input('profile_code'))->first();
        }

        return null;
    }
}
