<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        $targetUser = $this->route('user');
        return $this->user()?->can('update', $targetUser) === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $userId = $this->route('user')?->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', "unique:users,email,{$userId}"],
            'username' => ['required', 'string', 'max:255', 'alpha_dash', "unique:users,username,{$userId}"],
            'role' => ['required', 'string', 'exists:roles,name'],
        ];
    }
}
