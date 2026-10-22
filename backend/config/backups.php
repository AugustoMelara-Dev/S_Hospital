<?php

return [
    'private_temp_root' => env('HOSPITAL_BACKUP_PRIVATE_TEMP_ROOT'),
    'dump_binary' => env('HOSPITAL_DUMP_BINARY', ''),
    'retention' => [
        'successful_count' => max(1, (int) env('HOSPITAL_BACKUP_KEEP_SUCCESSFUL', 30)),
        'manual' => [
            'keep_successful' => max(1, (int) env('HOSPITAL_BACKUP_KEEP_MANUAL_SUCCESSFUL', 10)),
            'keep_days' => max(0, (int) env('HOSPITAL_BACKUP_KEEP_MANUAL_DAYS', 30)),
        ],
        'scheduled' => [
            'keep_successful' => max(1, (int) env('HOSPITAL_BACKUP_KEEP_SCHEDULED_SUCCESSFUL', 96)),
            'keep_days' => max(0, (int) env('HOSPITAL_BACKUP_KEEP_SCHEDULED_DAYS', 7)),
        ],
    ],
    'encryption' => [
        'key' => env('HOSPITAL_BACKUP_ENCRYPTION_KEY'),
        'cipher' => 'aes-256-gcm',
    ],
    /*
     | Copia externa cifrada (F019 / HS-BK-EXT). Desactivada por defecto:
     | sin un destino real configurado no se declara la copia como desplegada.
     | Guard fail-closed (RV-T2-010): solo un root explicito, absoluto y fuera
     | del storage/ y del proyecto cuenta como destino; vacio, relativo o
     | interno -> failed con external_configured=false/external_deployed=false.
     */
    'external' => [
        'enabled' => filter_var(env('HOSPITAL_BACKUP_EXTERNAL_ENABLED', false), FILTER_VALIDATE_BOOL),
        'disk' => env('HOSPITAL_BACKUP_EXTERNAL_DISK', 'backup_external'),
        'path' => trim((string) env('HOSPITAL_BACKUP_EXTERNAL_PATH', 'hospital-backups'), " \t\n\r\0\x0B/\\"),
        'label' => trim((string) env('HOSPITAL_BACKUP_EXTERNAL_LABEL', 'externo')),
        'verify' => filter_var(env('HOSPITAL_BACKUP_EXTERNAL_VERIFY', true), FILTER_VALIDATE_BOOL),
    ],
    /*
     | Alertas locales de salud de respaldos (HS-BK-ALERT). Los umbrales son
     | configurables por operacion; el canal externo no esta desplegado.
     |
     | `stale_after_hours` vigila la CREACION (completed_at). La verificacion de
     | recuperabilidad solo corre con `hospital:verify-backup --latest` (diaria
     | 02:30), asi que la ultima copia verificada puede llegar a ~24 h aunque la
     | creacion sea reciente: `recoverable_stale_after_hours` (default 26 h)
     | cierra esa brecha de RPO y deja margen sobre la cadencia diaria.
     */
    'alerts' => [
        'stale_after_hours' => max(1, (int) env('HOSPITAL_BACKUP_ALERT_STALE_HOURS', 12)),
        'consecutive_failures' => max(1, (int) env('HOSPITAL_BACKUP_ALERT_CONSECUTIVE_FAILURES', 3)),
        'external_stale_after_hours' => max(1, (int) env('HOSPITAL_BACKUP_ALERT_EXTERNAL_STALE_HOURS', 26)),
        'recoverable_stale_after_hours' => max(1, (int) env('HOSPITAL_BACKUP_ALERT_RECOVERABLE_STALE_HOURS', 26)),
    ],
];
