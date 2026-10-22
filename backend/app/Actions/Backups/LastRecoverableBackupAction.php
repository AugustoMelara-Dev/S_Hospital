<?php

namespace App\Actions\Backups;

use App\Models\BackupLog;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Ultima copia recuperable real (HS-BK-VERIFY): respaldo exitoso que ademas
 * fue verificado descifrable con la llave configurada.
 *
 * Contrato T2-025:
 *   status='success' AND verify_status='verified' AND verified_at IS NOT NULL
 *   ORDER BY verified_at DESC, id DESC LIMIT 1
 */
class LastRecoverableBackupAction
{
    /**
     * @return array{id: int, filename: string, verified_at: string, age_seconds: int, size_bytes: int|null}|null
     */
    public function execute(): ?array
    {
        $row = DB::table('backup_logs')
            ->select(['id', 'filename', 'verified_at', 'size_bytes'])
            ->where('status', BackupLog::STATUS_SUCCESS)
            ->where('verify_status', VerifyBackupAction::STATUS_VERIFIED)
            ->whereNotNull('verified_at')
            ->orderByDesc('verified_at')
            ->orderByDesc('id')
            ->first();

        if ($row === null) {
            return null;
        }

        $verifiedAt = $row->verified_at;
        $parsed = is_string($verifiedAt) && $verifiedAt !== '' ? Carbon::parse($verifiedAt) : null;

        if ($parsed === null) {
            return null;
        }

        return [
            'id' => is_numeric($row->id) ? (int) $row->id : 0,
            'filename' => is_string($row->filename) ? $row->filename : '',
            'verified_at' => $parsed->toIso8601String(),
            'age_seconds' => (int) $parsed->diffInSeconds(now(), true),
            'size_bytes' => is_numeric($row->size_bytes) ? (int) $row->size_bytes : null,
        ];
    }
}
