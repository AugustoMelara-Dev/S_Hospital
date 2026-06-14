<?php

namespace App\Policies;

use App\Models\FiscalSetting;
use App\Models\User;

/**
 * Authorization for fiscal settings. The FormRequests and
 * FiscalSettingsController already gate on `settings.fiscal.view`
 * and `settings.fiscal.update`. The policy mirrors those
 * permission strings so `Gate::authorize('update', $setting)`
 * resolves correctly.
 */
class FiscalSettingPolicy
{
    public function view(User $user, FiscalSetting $setting): bool
    {
        return $user->can('settings.fiscal.view');
    }

    public function update(User $user, FiscalSetting $setting): bool
    {
        return $user->can('settings.fiscal.update');
    }
}
