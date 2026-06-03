<?php

declare(strict_types=1);

namespace App\Http\Requests\System;

use Illuminate\Foundation\Http\FormRequest;

class ShowSystemStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('system.status.view') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
