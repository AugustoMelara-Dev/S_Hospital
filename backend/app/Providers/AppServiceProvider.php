<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Observers\PermissionAuditObserver;
use App\Policies\CashSessionPolicy;
use App\Policies\InvoicePolicy;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use RuntimeException;
use Spatie\Permission\Events\PermissionAttached;
use Spatie\Permission\Events\PermissionDetached;
use Spatie\Permission\Events\RoleAttached;
use Spatie\Permission\Events\RoleDetached;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Minimum length enforced for HOSPITAL_LICENSE_SALT in production.
     * AGENTS.md mandates 32+ random characters; the embedded dev salt
     * is intentionally rejected to force operators to rotate it.
     */
    private const MIN_PROD_SALT_LENGTH = 32;

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
        $this->assertProductionLicenseSalt();
        $this->registerPermissionAudit();
        $this->registerPolicies();
    }

    /**
     * Reject a missing or short HOSPITAL_LICENSE_SALT in production.
     * In dev and testing the dev fallback is allowed so the test
     * suite and `composer run` keep working without a real salt.
     */
    private function assertProductionLicenseSalt(): void
    {
        $environment = (string) ($_ENV['APP_ENV'] ?? $_SERVER['APP_ENV'] ?? config('app.env'));

        if ($environment !== 'production') {
            return;
        }

        $configured = (string) config('app.license_salt');

        if ($configured === '' || strlen($configured) < self::MIN_PROD_SALT_LENGTH) {
            throw new RuntimeException(sprintf(
                'HOSPITAL_LICENSE_SALT must be at least %d characters in production (AGENTS.md). '.
                'Run `php -r "echo bin2hex(random_bytes(32));"` and update the .env file.',
                self::MIN_PROD_SALT_LENGTH,
            ));
        }
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
    }
}
