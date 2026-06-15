<?php

namespace App\Actions\System;

use App\Support\System\OperationalCheck;

class BuildOperationalStatusAction
{
    /**
     * @param  array<string, mixed>  $status
     * @return array<string, mixed>
     */
    public function addSummary(array $status): array
    {
        $checks = collect($status['preflight']['production_checks'] ?? []);
        $proofs = collect($status['preflight']['physical_proofs'] ?? []);
        $blockers = collect($status['readiness']['blockers'] ?? []);

        $problemCount = $checks
            ->merge($proofs)
            ->merge($blockers)
            ->filter(fn (array $item): bool => ($item['status'] ?? 'pending') !== 'validated')
            ->count();

        $severity = $this->severityFromProblemCount($problemCount);

        $status['summary'] = [
            'severity' => $severity,
            'problem_count' => $problemCount,
            'label' => $this->labelForSeverity($severity),
        ];

        return $status;
    }

    /**
     * @param  array<string, mixed>  $status
     * @return array<string, mixed>
     */
    public function publicSummary(array $status): array
    {
        $checks = [
            $this->check('BACKEND_ACTIVE', 'Servidor activo', 'validated', 'El servidor respondio esta solicitud.'),
            $this->databaseCheck($status),
            $this->frontendCheck($status),
            $this->backupCheck($status),
            $this->queueCheck($status),
            $this->systemTimeCheck($status),
            $this->diskSpaceCheck($status),
            $this->lanAccessCheck($status),
            $this->versionCheck($status),
        ];

        $severity = $this->severityFromChecks($checks);

        return [
            'summary' => [
                'severity' => $severity,
                'problem_count' => collect($checks)->filter(fn (array $check): bool => $check['status'] !== 'validated')->count(),
                'label' => $this->labelForSeverity($severity),
                'action' => $this->actionForSeverity($severity),
            ],
            'checks' => $checks,
            'advanced_available' => true,
        ];
    }

    /**
     * @param  array<string, mixed>  $status
     */
    private function databaseCheck(array $status): array
    {
        $database = $status['database'] ?? [];
        $connected = ($database['connected'] ?? false) === true;
        $isMysql = ($database['is_mysql_family'] ?? false) === true;

        if (! $connected) {
            return $this->check('DATABASE_CONNECTED', 'Base de datos conectada', 'error', 'No se pudo confirmar la conexion. Llame a soporte y evite reiniciar la caja varias veces.');
        }

        return $this->check(
            'DATABASE_CONNECTED',
            'Base de datos conectada',
            $isMysql ? 'validated' : 'warning',
            $isMysql ? 'Conexion local verificada.' : 'La conexion responde, pero requiere revision tecnica.'
        );
    }

    /**
     * @param  array<string, mixed>  $status
     */
    private function frontendCheck(array $status): array
    {
        $available = (($status['runtime']['frontend_build']['available'] ?? false) === true);

        return $this->check(
            'FRONTEND_AVAILABLE',
            'Pantalla web disponible',
            $available ? 'validated' : 'error',
            $available ? 'La pantalla instalada esta lista para abrirse en navegador.' : 'Falta la pantalla instalada. Ejecute reparacion segura o llame a soporte.'
        );
    }

    /**
     * @param  array<string, mixed>  $status
     */
    private function backupCheck(array $status): array
    {
        $backups = $status['backups'] ?? [];

        if (($backups['last_failure_at'] ?? null) !== null && ($backups['last_success_at'] ?? null) === null) {
            return $this->check('LATEST_BACKUP', 'Ultimo respaldo', 'error', 'El ultimo intento fallo y no hay respaldo exitoso registrado.');
        }

        if (($backups['last_success_at'] ?? null) === null) {
            return $this->check('LATEST_BACKUP', 'Ultimo respaldo', 'warning', 'No hay respaldo exitoso registrado todavia. Crear uno desde Respaldos.');
        }

        return $this->check('LATEST_BACKUP', 'Ultimo respaldo', 'validated', 'Hay un respaldo exitoso registrado.');
    }

    /**
     * @param  array<string, mixed>  $status
     */
    private function queueCheck(array $status): array
    {
        $queue = $status['backups']['queue'] ?? [];
        $failed = (int) ($queue['failed_jobs_count'] ?? 0);
        $pending = (int) ($queue['pending_backup_jobs'] ?? 0);

        if ($failed > 0) {
            return $this->check('JOB_QUEUE', 'Trabajos de respaldo', 'error', 'Hay trabajos fallidos. Soporte debe revisar la bitacora avanzada.');
        }

        if ($pending > 0) {
            return $this->check('JOB_QUEUE', 'Trabajos de respaldo', 'warning', 'Hay respaldos en cola. Espere unos minutos y actualice.');
        }

        return $this->check('JOB_QUEUE', 'Trabajos de respaldo', 'validated', 'No hay fallos pendientes en la cola.');
    }

    /**
     * @param  array<string, mixed>  $status
     */
    private function systemTimeCheck(array $status): array
    {
        $time = (string) ($status['environment']['server_time'] ?? '');

        return $this->check(
            'SYSTEM_TIME',
            'Hora del sistema',
            $time === '' ? 'warning' : 'validated',
            $time === '' ? 'No se pudo leer la hora del servidor.' : 'Hora del servidor registrada para auditoria.'
        );
    }

    /**
     * @param  array<string, mixed>  $status
     */
    private function diskSpaceCheck(array $status): array
    {
        $freeBytes = $status['backups']['storage']['free_bytes'] ?? null;

        if (! is_numeric($freeBytes)) {
            return $this->check('DISK_SPACE', 'Espacio para respaldos', 'warning', 'No se pudo calcular el espacio disponible.');
        }

        $oneGb = 1024 * 1024 * 1024;
        $fiveGb = 5 * $oneGb;

        if ($freeBytes < $oneGb) {
            return $this->check('DISK_SPACE', 'Espacio para respaldos', 'error', 'Queda muy poco espacio. No cree muchos respaldos sin avisar a soporte.');
        }

        if ($freeBytes < $fiveGb) {
            return $this->check('DISK_SPACE', 'Espacio para respaldos', 'warning', 'Espacio bajo. Programar limpieza segura de respaldos antiguos.');
        }

        return $this->check('DISK_SPACE', 'Espacio para respaldos', 'validated', 'Hay espacio suficiente para respaldos.');
    }

    /**
     * @param  array<string, mixed>  $status
     */
    private function lanAccessCheck(array $status): array
    {
        $proofs = collect($status['preflight']['physical_proofs'] ?? []);
        $lan = $proofs->firstWhere('code', 'LAN_CLIENT_VALIDATION_PROOF');

        return $this->check(
            'LAN_ACCESS',
            'Acceso por red local',
            ($lan['status'] ?? 'pending') === 'validated' ? 'validated' : 'manual_required',
            ($lan['status'] ?? 'pending') === 'validated'
                ? 'Validado desde una computadora cliente.'
                : 'Debe probarse desde otra computadora del hospital.'
        );
    }

    /**
     * @param  array<string, mixed>  $status
     */
    private function versionCheck(array $status): array
    {
        $version = (string) ($status['runtime']['installed_version'] ?? '');

        return $this->check(
            'INSTALLED_VERSION',
            'Version instalada',
            $version === '' ? 'warning' : 'validated',
            $version === '' ? 'Version no registrada; soporte debe documentarla.' : 'Version '.$version.' registrada.'
        );
    }

    /**
     * @return array{code: string, label: string, status: string, detail: string}
     */
    private function check(string $code, string $label, string $status, string $detail): array
    {
        return (new OperationalCheck($code, $label, $status, $detail))->toArray();
    }

    /**
     * @param  array<int, array{status: string}>  $checks
     */
    private function severityFromChecks(array $checks): string
    {
        $statuses = collect($checks)->pluck('status');

        if ($statuses->contains('error')) {
            return 'error';
        }

        if ($statuses->contains(fn (string $status): bool => in_array($status, ['warning', 'manual_required'], true))) {
            return 'warning';
        }

        return 'ok';
    }

    private function severityFromProblemCount(int $problemCount): string
    {
        return $problemCount === 0 ? 'ok' : ($problemCount <= 2 ? 'warning' : 'error');
    }

    private function labelForSeverity(string $severity): string
    {
        return match ($severity) {
            'ok' => 'Todo bien',
            'error' => 'Error',
            default => 'Requiere revision',
        };
    }

    private function actionForSeverity(string $severity): string
    {
        return match ($severity) {
            'ok' => 'Continuar operando y mantener el cierre de caja normal.',
            'error' => 'Avisar a supervisor o soporte antes de repetir acciones delicadas.',
            default => 'Revisar los puntos marcados y completar las acciones indicadas.',
        };
    }
}
