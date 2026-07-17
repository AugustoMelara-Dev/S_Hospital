<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use App\Support\VisiblePermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        $targetUser = $this->route('user');

        return $targetUser instanceof User
            && $this->user()?->can('update', $targetUser) === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $targetUser = $this->route('user');
        $uniqueEmail = Rule::unique('users', 'email');
        $uniqueUsername = Rule::unique('users', 'username');

        if ($targetUser instanceof User) {
            $uniqueEmail->ignore($targetUser);
            $uniqueUsername->ignore($targetUser);
        }

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', $uniqueEmail],
            'username' => ['required', 'string', 'max:255', 'alpha_dash', $uniqueUsername],
            'role' => ['required', 'string', Rule::exists('roles', 'name')->where('guard_name', 'web')],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['required', 'string', 'distinct', Rule::notIn(VisiblePermissions::hiddenPermissionNames()), Rule::exists('permissions', 'name')->where('guard_name', 'web')],
        ];
    }
}
