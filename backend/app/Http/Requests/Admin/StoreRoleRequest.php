<?php

namespace App\Http\Requests\Admin;

use App\Support\RoleCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('users.assign_admin_role') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:80',
                'alpha_dash',
                RoleCatalog::notProtectedRoleNameRule(),
                Rule::unique('roles', 'name')->where('guard_name', 'web'),
            ],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => [
                'required',
                'string',
                'distinct',
                Rule::notIn(RoleCatalog::hiddenPermissionNames()),
                Rule::exists('permissions', 'name')->where('guard_name', 'web'),
            ],
        ];
    }
}
