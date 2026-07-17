<?php

return [
    'installed_version' => env('HOSPITAL_APP_VERSION', '0.1.0'),
    'project_root' => env('HOSPITAL_PROJECT_ROOT', dirname(base_path())),
    'schedule' => [
        'daily_backup_time' => env('HOSPITAL_DAILY_BACKUP_TIME', '02:00'),
        'operation_start' => env('HOSPITAL_OPERATION_START', '06:00'),
        'operation_end' => env('HOSPITAL_OPERATION_END', '18:00'),
        'audit_retention_days' => (int) env('HOSPITAL_AUDIT_RETENTION_DAYS', 365),
        'failed_jobs_retention_days' => (int) env('HOSPITAL_FAILED_JOBS_RETENTION_DAYS', 30),
        'idempotency_retention_days' => (int) env('HOSPITAL_IDEMPOTENCY_RETENTION_DAYS', 30),
        'scheduler_tick_retention_days' => (int) env('HOSPITAL_SCHEDULER_TICK_RETENTION_DAYS', 7),
        'login_attempt_retention_days' => (int) env('HOSPITAL_LOGIN_ATTEMPT_RETENTION_DAYS', 30),
        'client_error_retention_days' => (int) env('HOSPITAL_CLIENT_ERROR_RETENTION_DAYS', 90),
    ],
];
