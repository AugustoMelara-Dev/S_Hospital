<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ToggleUserActiveRequest extends FormRequest
{
    public function authorize(): bool
    {
        $target = $this->route('user');

        if ($target instanceof User && $target->is($this->user())) {
            return $this->user()?->can('users.disable') === true;
        }

        return $target instanceof User && $this->user()?->can('toggleActive', $target) === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $targetUser = $this->route('user');

            if ($targetUser instanceof User && $targetUser->is($this->user())) {
                $validator->errors()->add('active', 'No puedes desactivar tu propio usuario.');
            }

            if (! $targetUser instanceof User || ! $targetUser->active) {
                return;
            }

            $reason = $this->input('reason');
            $reasonText = is_string($reason) ? trim($reason) : '';

            if ($reasonText === '') {
                $validator->errors()->add('reason', 'Indique el motivo para desactivar el usuario.');

                return;
            }

            if (mb_strlen($reasonText) < 5) {
                $validator->errors()->add('reason', 'Indique al menos 5 caracteres explicando la desactivacion del usuario.');
            }
        });
    }
}
