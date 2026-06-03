<?php

declare(strict_types=1);

namespace App\Http\Requests\Backups;

use App\Models\BackupLog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexBackupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('backups.view') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'string', Rule::in([
                BackupLog::STATUS_PENDING,
                BackupLog::STATUS_SUCCESS,
                BackupLog::STATUS_FAILED,
            ])],
        ];
    }

    public function perPage(): int
    {
        return max(1, min((int) $this->integer('per_page', 15), 50));
    }
}
