<?php

return [
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
];
