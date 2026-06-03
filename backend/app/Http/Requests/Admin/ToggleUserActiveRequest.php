<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ToggleUserActiveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('users.disable') === true;
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
