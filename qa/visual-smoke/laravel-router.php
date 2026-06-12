<?php

require dirname(__DIR__, 2).DIRECTORY_SEPARATOR.'backend'.DIRECTORY_SEPARATOR.'vendor'.DIRECTORY_SEPARATOR.'autoload.php';

use App\Models\User;
use Illuminate\Cookie\CookieValuePrefix;
use Illuminate\Http\Request;
use Illuminate\Contracts\Console\Kernel as ConsoleKernel;

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

$publicPath = dirname(__DIR__, 2).DIRECTORY_SEPARATOR.'backend'.DIRECTORY_SEPARATOR.'public';
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$requestedFile = realpath($publicPath.$requestPath);

if ($requestPath === '/__qa_session') {
    $app = require dirname(__DIR__, 2).DIRECTORY_SEPARATOR.'backend'.DIRECTORY_SEPARATOR.'bootstrap'.DIRECTORY_SEPARATOR.'app.php';
    $app->make(ConsoleKernel::class)->bootstrap();

    $login = (string) ($_GET['login'] ?? 'admin.validacion');
    $user = User::query()
        ->where('username', $login)
        ->orWhere('email', $login)
        ->firstOrFail();

    $session = $app['session']->driver();
    $session->start();

    $request = Request::capture();
    $request->setLaravelSession($session);
    $app->instance('request', $request);

    $guard = $app['auth']->guard('web');
    $guard->setRequest($request);
    $guard->login($user);
    $session->save();

    $cookieName = config('session.cookie');
    $cookiePath = config('session.path', '/');
    $sameSite = config('session.same_site', 'lax');
    $secure = (bool) config('session.secure', false);
    $httpOnly = (bool) config('session.http_only', true);
    $domain = config('session.domain');
    $encrypter = $app['encrypter'];
    $sessionCookie = $encrypter->encrypt(
        CookieValuePrefix::create($cookieName, $encrypter->getKey()).$session->getId(),
        false,
    );

    setcookie($cookieName, $sessionCookie, [
        'expires' => time() + 7200,
        'path' => $cookiePath,
        'domain' => $domain ?: '',
        'secure' => $secure,
        'httponly' => $httpOnly,
        'samesite' => $sameSite,
    ]);

    setcookie('XSRF-TOKEN', $session->token(), [
        'expires' => time() + 7200,
        'path' => $cookiePath,
        'domain' => $domain ?: '',
        'secure' => $secure,
        'httponly' => false,
        'samesite' => $sameSite,
    ]);

    header('Content-Type: application/json');
    echo json_encode([
        'ok' => true,
        'login' => $login,
        'session_cookie_name' => $cookieName,
        'session_cookie_value' => $sessionCookie,
        'xsrf_token' => $session->token(),
    ], JSON_PRETTY_PRINT);

    return true;
}

if ($requestPath !== '/' && $requestedFile !== false && str_starts_with($requestedFile, realpath($publicPath))) {
    return false;
}

chdir($publicPath);
require $publicPath.DIRECTORY_SEPARATOR.'index.php';
