<?php

namespace App\Support;

use App\Http\Middleware\RequestCorrelation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class SafeExceptionDiagnostics
{
    public static function record(Throwable $exception, string $event, string $diagnosticCode, ?string $stage = null, ?int $backupId = null, ?string $originRequestId = null): void
    {
        $request = app()->bound('request') ? app('request') : null;
        $trace = [];
        foreach (array_slice($exception->getTrace(), 0, 12) as $frame) {
            $trace[] = [
                'call' => self::symbol($frame['class'] ?? '').(isset($frame['class']) ? '::' : '').self::symbol($frame['function']),
                'line' => isset($frame['line']) ? (int) $frame['line'] : null,
            ];
        }
        $code = (string) $exception->getCode();
        $context = [
            'diagnostic_code' => $diagnosticCode,
            'request_id' => is_string($originRequestId) && Str::isUuid($originRequestId)
                ? $originRequestId
                : ($request instanceof Request ? RequestCorrelation::id($request) : (string) Str::uuid()),
            'exception_type' => self::symbol($exception::class),
            'exception_code' => preg_match('/^\d{1,10}$/D', $code) === 1 ? $code : null,
            'reason_code' => self::reasonCode($exception),
            'exception_line' => $exception->getLine(),
            'trace' => $trace,
        ];
        if ($stage !== null) {
            $context['stage'] = $stage;
        }
        if ($backupId !== null) {
            $context['backup_id'] = $backupId;
        }
        if ($exception->getPrevious() !== null) {
            $context['previous_exception_type'] = self::symbol($exception->getPrevious()::class);
        }

        // Do not pass the Throwable, its message, file, arguments, request data,
        // URL, SQL or bindings to the logger. Anonymous symbols may contain paths.
        Log::error($event, $context);
    }

    private static function reasonCode(Throwable $exception): string
    {
        // Classify known failures without ever retaining the input message.
        $message = $exception->getMessage();
        if (preg_match('/\b(?:error|errno)[:\s]+2026\b/i', $message) === 1) {
            return 'DATABASE_TLS_FAILED';
        }
        if (preg_match('/\b(?:error|errno)[:\s]+(?:1044|1045|1142)\b/i', $message) === 1) {
            return 'DATABASE_ACCESS_DENIED';
        }
        if (preg_match('/\b(?:error|errno)[:\s]+(?:2002|2003|2013)\b/i', $message) === 1) {
            return 'DATABASE_CONNECTION_FAILED';
        }
        if (preg_match('/timed out|timeout/i', $message) === 1) {
            return 'OPERATION_TIMEOUT';
        }
        if (preg_match('/no space left|disk full/i', $message) === 1) {
            return 'STORAGE_FULL';
        }

        return 'UNCLASSIFIED_EXCEPTION';
    }

    private static function symbol(string $value): string
    {
        if (str_contains($value, '{closure')) {
            return '{closure}';
        }
        $value = explode('@anonymous', $value, 2)[0];

        return preg_match('/^[A-Za-z_\\\\][A-Za-z0-9_\\\\]*$/D', $value) === 1 ? $value : 'unknown';
    }
}
