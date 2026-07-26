<?php

use App\Models\User;
use App\Support\System\OperationalScheduleConfig;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('auth:has-active-admin
    {--json : Emitir resultado JSON para automatizacion local}', function () {
    $exists = User::role('admin')->where('active', true)->exists();

    if ($this->option('json')) {
        $this->line(json_encode([
            'active_admin_exists' => $exists,
        ], JSON_THROW_ON_ERROR));
    } else {
        $this->line($exists ? 'Existe un administrador activo.' : 'No existe un administrador activo.');
    }

    return $exists ? 0 : 1;
})->purpose('Verificar si la instalacion ya tiene un administrador activo.');

Artisan::command('auth:create-initial-admin
    {--username= : Username del admin inicial}
    {--email= : Email del admin inicial}
    {--name=Admin Local : Nombre visible del admin inicial}
    {--password= : Compatibilidad tecnica; preferir HOSPITAL_INITIAL_ADMIN_PASSWORD}', function () {
    if (User::role('admin')->where('active', true)->exists()) {
        $this->error('Ya existe un usuario admin activo.');

        return 1;
    }

    $usernameOption = $this->option('username');
    $emailOption = $this->option('email');
    $passwordOption = $this->option('password');
    $environmentPassword = getenv('HOSPITAL_INITIAL_ADMIN_PASSWORD');

    $username = is_string($usernameOption) ? trim($usernameOption) : '';
    $email = is_string($emailOption) ? trim($emailOption) : '';
    $password = is_string($passwordOption) && $passwordOption !== ''
        ? $passwordOption
        : (is_string($environmentPassword) ? $environmentPassword : '');

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

    $nameOption = $this->option('name');
    $user = User::query()->create([
        'name' => is_string($nameOption) ? $nameOption : 'Admin Local',
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
    ->dailyAt(OperationalScheduleConfig::time(config('hospital.schedule.daily_backup_time'), '02:00'))
    ->withoutOverlapping(120)
    ->onOneServer()
    ->runInBackground()
    ->description('Respaldo diario del Sistema de Caja Hospitalaria');

Schedule::command('hospital:backup --type=scheduled')
    ->everyFifteenMinutes()
    ->between(
        OperationalScheduleConfig::time(config('hospital.schedule.operation_start'), '06:00'),
        OperationalScheduleConfig::time(config('hospital.schedule.operation_end'), '18:00'),
    )
    ->withoutOverlapping(120)
    ->onOneServer()
    ->runInBackground()
    ->description('Respaldo automatico operativo del Sistema de Caja Hospitalaria');

Schedule::command('hospital:prune-audit-logs --days='.OperationalScheduleConfig::retentionDays(config('hospital.schedule.audit_retention_days'), 365))
    ->dailyAt('03:15')
    ->onOneServer()
    ->withoutOverlapping(60)
    ->runInBackground()
    ->description('Podar audit_logs anteriores a la retencion configurada');

Schedule::command('hospital:prune-failed-jobs --days='.OperationalScheduleConfig::retentionDays(config('hospital.schedule.failed_jobs_retention_days'), 30))
    ->dailyAt('03:30')
    ->onOneServer()
    ->withoutOverlapping(30)
    ->runInBackground()
    ->description('Podar failed_jobs anteriores a la retencion configurada');

Schedule::command('hospital:prune-idempotency-keys --days='.OperationalScheduleConfig::retentionDays(config('hospital.schedule.idempotency_retention_days'), 30))
    ->dailyAt('03:45')
    ->onOneServer()
    ->withoutOverlapping(30)
    ->runInBackground()
    ->description('Podar llaves de idempotencia anteriores a la retencion configurada');

Schedule::command('hospital:prune-scheduler-ticks --days='.OperationalScheduleConfig::retentionDays(config('hospital.schedule.scheduler_tick_retention_days'), 7))
    ->dailyAt('04:00')
    ->onOneServer()
    ->withoutOverlapping(30)
    ->runInBackground()
    ->description('Podar heartbeats antiguos del scheduler local');

Schedule::command(
    'hospital:prune-operational-logs'
    .' --login-days='.OperationalScheduleConfig::retentionDays(config('hospital.schedule.login_attempt_retention_days'), 30)
    .' --client-error-days='.OperationalScheduleConfig::retentionDays(config('hospital.schedule.client_error_retention_days'), 90),
)
    ->dailyAt('04:15')
    ->onOneServer()
    ->withoutOverlapping(30)
    ->runInBackground()
    ->description('Podar intentos de acceso y errores de navegador antiguos');
