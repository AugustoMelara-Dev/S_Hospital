<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('login')) {
            $login = $this->input('login');

            if (! is_string($login)) {
                return;
            }

            $this->merge([
                'login' => mb_strtolower(trim($login)),
            ]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'login' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
        ];
    }

    /** @return array{login: string, password: string} */
    public function validatedPayload(): array
    {
        return [
            'login' => $this->string('login')->toString(),
            'password' => $this->string('password')->toString(),
        ];
    }
}
