<?php

declare(strict_types=1);

namespace App\Http\Requests\System;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Guards the operational health snapshot. The public liveness probe stays
 * on GET /api/system/health; the detailed snapshot requires the same
 * permission used by the rest of the technical diagnostics
 * (system.status.view).
 */
class ShowSystemHealthRequest extends FormRequest
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
