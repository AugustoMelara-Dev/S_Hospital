<?php

namespace App\Policies;

use App\Models\BackupLog;
use App\Models\User;

class BackupLogPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('backups.view') || $user->hasRole('admin');
    }

    public function create(User $user): bool
    {
        return $user->can('backups.create') || $user->hasRole('admin');
    }

    public function download(User $user, BackupLog $backupLog): bool
    {
        return $user->can('backups.download') || $user->hasRole('admin');
    }
}
