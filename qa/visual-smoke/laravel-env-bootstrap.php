<?php

$forwardedKeys = [
    'LARAVEL_STORAGE_PATH',
    'CACHE_STORE',
    'SESSION_DRIVER',
    'LOG_CHANNEL',
];

foreach ($forwardedKeys as $key) {
    $value = getenv($key);

    if ($value === false || $value === '') {
        continue;
    }

    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
    putenv(sprintf('%s=%s', $key, $value));
}
