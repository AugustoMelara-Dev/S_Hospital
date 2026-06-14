<?php

namespace App\Providers;

use App\Models\Area;
use App\Models\BackupLog;
use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use App\Observers\PermissionAuditObserver;
use App\Policies\AreaPolicy;
use App\Policies\BackupLogPolicy;
use App\Policies\CashSessionPolicy;
use App\Policies\CategoryPolicy;
use App\Policies\FiscalSequencePolicy;
use App\Policies\FiscalSettingPolicy;
use App\Policies\InvoicePolicy;
use App\Policies\PaymentPolicy;
use App\Policies\ServicePolicy;
use App\Policies\UserPolicy;
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
     * Gate::getPolicyFor(...) can prove the mapping in tests, and
     * controllers that need to `Gate::deny(...)` on a resource have
     * a single class to import.
     */
    private function registerPolicies(): void
    {
        Gate::policy(Invoice::class, InvoicePolicy::class);
        Gate::policy(CashRegisterSession::class, CashSessionPolicy::class);
        Gate::policy(Service::class, ServicePolicy::class);
        Gate::policy(Payment::class, PaymentPolicy::class);
        Gate::policy(BackupLog::class, BackupLogPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(FiscalSetting::class, FiscalSettingPolicy::class);
        Gate::policy(FiscalSequence::class, FiscalSequencePolicy::class);
        Gate::policy(Category::class, CategoryPolicy::class);
        Gate::policy(Area::class, AreaPolicy::class);
    }
}
