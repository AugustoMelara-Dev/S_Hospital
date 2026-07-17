<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('auth:create-initial-admin
    {--username= : Username del admin inicial}
    {--email= : Email del admin inicial}
    {--name=Admin Local : Nombre visible del admin inicial}
    {--password= : Compatibilidad tecnica; preferir HOSPITAL_INITIAL_ADMIN_PASSWORD}', function () {
    if (User::role('admin')->where('active', true)->exists()) {
        $this->error('Ya existe un usuario admin activo.');

        return 1;
    }

    $username = trim((string) $this->option('username'));
    $email = trim((string) $this->option('email'));
    $password = (string) ($this->option('password') ?: getenv('HOSPITAL_INITIAL_ADMIN_PASSWORD') ?: '');

    if ($username === '' || $email === '' || $password === '') {
        $this->error('Debe enviar --username, --email y una contrasena por HOSPITAL_INITIAL_ADMIN_PASSWORD o --password.');

        return 1;
    }

    if (
        strlen($password) < 12
        || ! preg_match('/[a-z]/', $password)
        || ! preg_match('/[A-Z]/', $password)
        || ! preg_match('/\d/', $password)
        || ! preg_match('/[^A-Za-z0-9]/', $password)
    ) {
        $this->error('La contrasena temporal debe tener al menos 12 caracteres, con mayuscula, minuscula, numero y simbolo.');

        return 1;
    }

    $user = User::query()->create([
        'name' => (string) $this->option('name'),
        'username' => $username,
        'email' => $email,
        'password' => Hash::make($password),
        'active' => true,
        'must_change_password' => true,
    ]);
    $user->assignRole('admin');

    $this->info('Admin inicial creado con cambio obligatorio de contrasena.');

    return 0;
})->purpose('Crear el admin inicial de produccion offline con password temporal.');

Schedule::command('hospital:backup --type=scheduled')
    ->dailyAt((string) env('HOSPITAL_DAILY_BACKUP_TIME', '02:00'))
    ->withoutOverlapping(120)
    ->onOneServer()
    ->runInBackground()
    ->description('Respaldo diario del Sistema de Caja Hospitalaria');

Schedule::command('hospital:backup --type=scheduled')
    ->everyFifteenMinutes()
    ->between((string) env('HOSPITAL_OPERATION_START', '06:00'), (string) env('HOSPITAL_OPERATION_END', '18:00'))
    ->withoutOverlapping(120)
    ->onOneServer()
    ->runInBackground()
    ->description('Respaldo automatico operativo del Sistema de Caja Hospitalaria');

Schedule::command('hospital:prune-audit-logs --days='.(int) env('HOSPITAL_AUDIT_RETENTION_DAYS', 365))
    ->dailyAt('03:15')
    ->onOneServer()
    ->withoutOverlapping(60)
    ->runInBackground()
    ->description('Podar audit_logs anteriores a la retencion configurada');

Schedule::command('hospital:prune-failed-jobs --days='.(int) env('HOSPITAL_FAILED_JOBS_RETENTION_DAYS', 30))
    ->dailyAt('03:30')
    ->onOneServer()
    ->withoutOverlapping(30)
    ->runInBackground()
    ->description('Podar failed_jobs anteriores a la retencion configurada');

Schedule::command('hospital:prune-idempotency-keys --days='.(int) env('HOSPITAL_IDEMPOTENCY_RETENTION_DAYS', 30))
    ->dailyAt('03:45')
    ->onOneServer()
    ->withoutOverlapping(30)
    ->runInBackground()
    ->description('Podar llaves de idempotencia anteriores a la retencion configurada');
