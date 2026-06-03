<?php

namespace App\Providers;

use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Observers\PermissionAuditObserver;
use App\Policies\CashSessionPolicy;
use App\Policies\InvoicePolicy;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
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
        $this->registerPolicies();
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

    /**
     * Register the AGENTS.md-mandated Policies. Laravel 12 does
     * not auto-discover policies; we wire them explicitly so the
     * Gate facade can resolve `Gate::authorize('void', $invoice)`.
     *
     * The policy methods delegate to the same checks the FormRequest
     * authorize() methods and the Actions use, so the behaviour
     * is unchanged for the existing endpoints. The win is that
     * `php artisan policy:list` now shows the matrix, and
     * controllers that need to `Gate::deny(...)` on a resource
     * have a single class to import.
     */
    private function registerPolicies(): void
    {
        Gate::policy(Invoice::class, InvoicePolicy::class);
        Gate::policy(CashRegisterSession::class, CashSessionPolicy::class);
    }
}
