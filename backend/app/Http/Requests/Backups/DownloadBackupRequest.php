<?php

namespace App\Http\Requests\Backups;

use Illuminate\Foundation\Http\FormRequest;

class DownloadBackupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('backups.download') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
