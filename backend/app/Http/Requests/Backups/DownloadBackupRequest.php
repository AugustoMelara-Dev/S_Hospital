<?php

namespace App\Http\Requests\Backups;

use Illuminate\Foundation\Http\FormRequest;

class DownloadBackupRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null
            && $user->can('backups.view') === true
            && $user->can('backups.download') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
