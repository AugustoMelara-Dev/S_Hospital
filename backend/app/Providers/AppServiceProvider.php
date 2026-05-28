<?php

namespace App\Providers;

use App\Models\BackupLog;
use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\User;
use App\Policies\BackupLogPolicy;
use App\Policies\CashRegisterSessionPolicy;
use App\Policies\CategoryPolicy;
use App\Policies\InvoicePolicy;
use App\Policies\ServicePolicy;
use App\Policies\UserPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

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
        Gate::policy(Invoice::class, InvoicePolicy::class);
        Gate::policy(CashRegisterSession::class, CashRegisterSessionPolicy::class);
        Gate::policy(BackupLog::class, BackupLogPolicy::class);
        Gate::policy(Service::class, ServicePolicy::class);
        Gate::policy(Category::class, CategoryPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
    }
}
