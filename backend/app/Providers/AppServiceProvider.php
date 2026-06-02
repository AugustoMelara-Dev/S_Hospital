<?php

namespace App\Providers;

use App\Observers\PermissionAuditObserver;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Spatie\Permission\Events\PermissionAttached;
use Spatie\Permission\Events\PermissionDetached;
use Spatie\Permission\Events\RoleAttached;
use Spatie\Permission\Events\RoleDetached;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->registerPermissionAudit();
    }

    private function registerPermissionAudit(): void
    {
        $observer = new PermissionAuditObserver;

        Role::observe($observer);
        Permission::observe($observer);

        Event::listen(RoleAttached::class, fn (RoleAttached $event) => $observer->rolesAttached($event->model, $event->rolesOrIds));
        Event::listen(RoleDetached::class, fn (RoleDetached $event) => $observer->rolesDetached($event->model, $event->rolesOrIds));
        Event::listen(PermissionAttached::class, fn (PermissionAttached $event) => $observer->permissionsAttached($event->model, $event->permissionsOrIds));
        Event::listen(PermissionDetached::class, fn (PermissionDetached $event) => $observer->permissionsDetached($event->model, $event->permissionsOrIds));
    }
}
