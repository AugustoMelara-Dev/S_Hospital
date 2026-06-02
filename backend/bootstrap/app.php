<?php

use App\Http\Middleware\AddSecurityHeaders;
use App\Http\Middleware\EnsurePasswordIsChanged;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\ThrottleByUser;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
    )
    ->withCommands([
        __DIR__.'/../app/Console/Commands',
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->append(AddSecurityHeaders::class);
        $middleware->alias([
            'user.active' => EnsureUserIsActive::class,
            'password.changed' => EnsurePasswordIsChanged::class,
            'throttle.user' => ThrottleByUser::class,
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

            $status = $exception instanceof HttpExceptionInterface ? $exception->getStatusCode() : 500;

            if ($status === 401 && ! Route::has('login')) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
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
