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
        return [];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $targetUser = $this->route('user');

            if ($targetUser instanceof User && $targetUser->is($this->user())) {
                $validator->errors()->add('active', 'No puedes desactivar tu propio usuario.');
            }
        });
    }
}
