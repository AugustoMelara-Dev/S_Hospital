<?php

namespace App\Policies;

use App\Models\BackupLog;
use App\Models\User;

/**
 * Authorization for backup operations. Manual backup, list, download
 * and prune are admin/operator-only actions.
 */
class BackupLogPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('backups.view');
    }

    public function view(User $user, BackupLog $backupLog): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->can('backups.create');
    }

    public function download(User $user, BackupLog $backupLog): bool
    {
        return $user->can('backups.view') && $user->can('backups.download');
    }

    public function restore(User $user, BackupLog $backupLog): bool
    {
        return false;
    }
}
