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
    {--password= : Password temporal, debe cambiarse al entrar}', function () {
    if (User::role('admin')->exists()) {
        $this->error('Ya existe un usuario admin.');

        return 1;
    }

    $username = trim((string) $this->option('username'));
    $email = trim((string) $this->option('email'));
    $password = (string) $this->option('password');

    if ($username === '' || $email === '' || $password === '') {
        $this->error('Debe enviar --username, --email y --password.');

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
