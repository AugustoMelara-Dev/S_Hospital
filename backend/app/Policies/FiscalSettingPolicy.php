<?php

namespace App\Policies;

use App\Models\FiscalSetting;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class FiscalSettingPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('settings.fiscal.view');
    }

    public function view(User $user, FiscalSetting $fiscalSetting): bool
    {
        return $user->can('settings.fiscal.view');
    }

    public function create(User $user): bool
    {
        return $user->can('settings.fiscal.create');
    }

    public function update(User $user, FiscalSetting $fiscalSetting): bool
    {
        return $user->can('settings.fiscal.update');
    }

    public function delete(User $user, FiscalSetting $fiscalSetting): bool
    {
        return false;
    }
}
