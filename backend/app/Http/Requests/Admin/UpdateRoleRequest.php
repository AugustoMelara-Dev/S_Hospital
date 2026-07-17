<?php

namespace App\Http\Requests\Admin;

use App\Support\RoleCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Spatie\Permission\Models\Role;

class UpdateRoleRequest extends FormRequest
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
        /** @var Role|null $role */
        $role = $this->route('role');

        return [
            'name' => [
                'required',
                'string',
                'max:80',
                'alpha_dash',
                RoleCatalog::notProtectedRoleNameRule(),
                Rule::unique('roles', 'name')->where('guard_name', 'web')->ignore($role?->id),
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

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                /** @var Role|null $role */
                $role = $this->route('role');

                if (! $role instanceof Role) {
                    return;
                }

                if ($role->guard_name !== 'web') {
                    $validator->errors()->add('role', 'El rol no pertenece al guard operativo web.');
                }

                if (RoleCatalog::isProtectedRoleName($role->name)) {
                    $validator->errors()->add('role', 'El rol administrativo base no se puede modificar desde el editor de modulos.');
                }
            },
        ];
    }
}
