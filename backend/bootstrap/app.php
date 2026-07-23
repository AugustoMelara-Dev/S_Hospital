<?php

use App\Http\Middleware\AddSecurityHeaders;
use App\Http\Middleware\EnsurePasswordIsChanged;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\IdempotencyKey;
use App\Http\Middleware\StripApiReadSessionCookies;
use App\Http\Middleware\ThrottleByUser;
use App\Support\OperationalMessageSanitizer;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\AuthenticateSession;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
    )
    ->withCommands([
        __DIR__.'/../app/Console/Commands',
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->validateCsrfTokens(except: [
            'api/system/csp-report',
        ]);
        $middleware->prepend(StripApiReadSessionCookies::class);
        $middleware->appendToGroup('web', AuthenticateSession::class);
        $middleware->append(AddSecurityHeaders::class);
        $middleware->alias([
            'user.active' => EnsureUserIsActive::class,
            'password.changed' => EnsurePasswordIsChanged::class,
            'throttle.user' => ThrottleByUser::class,
            'idempotency' => IdempotencyKey::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => $request->is('api/*') || $request->expectsJson()
        );

        $exceptions->render(function (Throwable $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            if ($exception instanceof ValidationException
                || $exception instanceof AuthorizationException
                || $exception instanceof AuthenticationException) {
                return null;
            }

            $status = $exception instanceof HttpExceptionInterface ? $exception->getStatusCode() : 500;

            if ($status === 401 && ! Route::has('login')) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            if ($status === 503) {
                return response()->json([
                    'message' => 'Sistema en mantenimiento. Vuelva a intentar en unos minutos.',
                ], 503);
            }

            if (
                $exception instanceof ModelNotFoundException
                || $exception->getPrevious() instanceof ModelNotFoundException
            ) {
                $message = str_contains((string) $request->route()?->uri(), 'cash-sessions')
                    ? 'La caja solicitada no existe o ya no está disponible.'
                    : 'El registro solicitado no existe o ya no está disponible.';

                return response()->json(['message' => $message], 404);
            }

            if ($exception instanceof QueryException && $exception->getCode() === '23000' && str_contains($exception->getMessage(), '1451')) {
                return response()->json([
                    'message' => 'No se puede eliminar el registro porque está en uso o tiene datos relacionados.',
                    'code' => 'CONFLICT',
                ], 409);
            }

            if ($status >= 500 && ! (bool) config('app.debug')) {
                return response()->json([
                    'message' => OperationalMessageSanitizer::message($exception->getMessage())
                        ?? 'Error tecnico registrado. Revise el paquete de soporte.',
                    'code' => 'SERVER_ERROR',
                ], $status);
            }

            return null;
        });

        // Custom HTML page when the cashier app is in maintenance
        // mode (storage/framework/down exists). API requests still
        // get a 503 JSON response.
        $exceptions->render(function (HttpException $exception, Request $request) {
            if ($exception->getStatusCode() !== 503) {
                return null;
            }
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => 'Sistema en mantenimiento. Vuelva a intentar en unos minutos.',
                ], 503);
            }
            $downFile = storage_path('framework/down');
            $message = 'El sistema está en mantenimiento. Vuelva a intentarlo en unos minutos.';
            if (is_file($downFile)) {
                $payload = json_decode((string) file_get_contents($downFile), true);
                if (is_array($payload) && ! empty($payload['message'])) {
                    $message = (string) $payload['message'];
                }
            }

            return response()->view('maintenance', ['message' => $message], 503);
        });
    })->create();
