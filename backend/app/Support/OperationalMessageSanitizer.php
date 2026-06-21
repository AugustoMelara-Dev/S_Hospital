<?php

namespace App\Support;

class OperationalMessageSanitizer
{
    public static function url(string $value): string
    {
        $parts = parse_url($value);

        if ($parts === false || ! isset($parts['scheme'], $parts['host'])) {
            return '';
        }

        $port = isset($parts['port']) ? ':'.(string) $parts['port'] : '';

        return "{$parts['scheme']}://{$parts['host']}{$port}";
    }

    public static function message(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $message = $value;
        if (preg_match('/(?i)\b(SQLSTATE|PDOException|Illuminate\\\\[A-Za-z\\\\]+|Traceback|Stack trace)\b/', $message) === 1) {
            return 'Error tecnico registrado. Revise el paquete de soporte.';
        }

        $message = preg_replace('/\b(https?:\/\/)(?:[^\s\/@]+@)([^\s]+)/i', '$1$2', $message) ?? $message;
        $message = preg_replace('/(?i)\bhospital_app@(?:\d{1,3}\.){3}\d{1,3}\b/', '[db-user-host]', $message) ?? $message;
        $message = preg_replace("/(?i)'hospital_app'@'(?:\d{1,3}\.){3}\d{1,3}'/", '[db-user-host]', $message) ?? $message;
        $message = preg_replace('/(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+/', '$1=[redacted]', $message) ?? $message;
        $message = preg_replace('/(?i)[A-Z]:\\\\[^\s`"\']+/', '[ruta-local]', $message) ?? $message;
        $message = preg_replace('#/(var|home|srv|opt|tmp|usr|mnt)/[^\s`"\']+#i', '[ruta-local]', $message) ?? $message;
        $message = trim($message);

        if ($message === '' || strlen($message) > 220) {
            return 'Error tecnico registrado. Revise el paquete de soporte.';
        }

        return $message;
    }
}
