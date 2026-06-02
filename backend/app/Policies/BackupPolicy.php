<?php

namespace App\Policies;

use App\Models\BackupLog;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class BackupPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('backups.view');
    }

    public function create(User $user): bool
    {
        return $user->can('backups.create');
    }

    public function delete(User $user, BackupLog $backupLog): bool
    {
        return $user->can('backups.delete');
    }
}