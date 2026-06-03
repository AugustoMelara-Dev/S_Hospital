<?php

return [
    'retention' => [
        'successful_count' => max(1, (int) env('HOSPITAL_BACKUP_KEEP_SUCCESSFUL', 30)),
    ],
];
