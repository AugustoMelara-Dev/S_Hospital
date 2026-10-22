<?php

use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;
use Laravel\Sanctum\Sanctum;

$defaultLocalStatefulDomains = [
    'localhost',
    'localhost:3000',
    'localhost:5173',
    '127.0.0.1',
    '127.0.0.1:8000',
    '127.0.0.1:5173',
    '::1',
    Sanctum::currentApplicationUrlWithPort(),
    Sanctum::currentRequestHost(),
];

$statefulDomains = env('SANCTUM_STATEFUL_DOMAINS');

if (env('APP_ENV') === 'production' && (! is_string($statefulDomains) || trim($statefulDomains) === '')) {
    throw new RuntimeException('Production Sanctum stateful domains must be explicit.');
}

$configuredStatefulDomains = is_string($statefulDomains)
    ? array_filter(array_map('trim', explode(',', $statefulDomains)))
    : [];

/**
 * The origins the deployment itself declares (APP_URL and the explicit CORS
 * allowlist) are first-party SPA origins by definition. Derive their
 * host[:port] forms so the TLS overlay, which switches APP_URL and
 * CORS_ALLOWED_ORIGINS to HOSPITAL_TLS_ORIGIN, keeps Sanctum stateful even
 * when that origin is a DNS name (generate_local_ca.ps1 -ServerNames) or uses
 * a non-default port. Without the derivation, login/CSRF over that origin
 * would fall out of the stateful middleware and answer 401.
 *
 * This does not relax the production fail-closed rule above: an explicit,
 * non-empty SANCTUM_STATEFUL_DOMAINS is still required in production; the
 * declared origins are added on top of it.
 *
 * Only absolute http(s) origins with a syntactically valid host qualify:
 * anything carrying a wildcard (e.g. `https://*.x`), schemeless or
 * protocol-relative values, malformed hosts and out-of-range ports are
 * ignored. Sanctum matches stateful entries through Str::is(), so a derived
 * `*.x` would silently become a pattern for every host under `.x`.
 */
$declaredOriginHosts = [];

foreach ([env('APP_URL'), env('CORS_ALLOWED_ORIGINS')] as $declaredOriginSource) {
    if (! is_string($declaredOriginSource)) {
        continue;
    }

    foreach (explode(',', $declaredOriginSource) as $declaredOrigin) {
        $declaredOrigin = trim($declaredOrigin);

        if ($declaredOrigin === '' || str_contains($declaredOrigin, '*')) {
            continue;
        }

        // Absolute http(s) only: a protocol-relative or schemeless value is
        // not a browser origin.
        $declaredScheme = parse_url($declaredOrigin, PHP_URL_SCHEME);
        if (! is_string($declaredScheme) || ! in_array(strtolower($declaredScheme), ['http', 'https'], true)) {
            continue;
        }

        $declaredHost = parse_url($declaredOrigin, PHP_URL_HOST);
        if (! is_string($declaredHost) || $declaredHost === '' || str_contains($declaredHost, '*')) {
            continue;
        }

        // Reject host shapes that can never be a browser authority host
        // (spaces, slashes, userinfo, ...). DNS names, IPv4 and bracketed
        // IPv6 literals are preserved.
        if (preg_match('/^[A-Za-z0-9._\-:\[\]]+$/', $declaredHost) !== 1) {
            continue;
        }

        $declaredPort = parse_url($declaredOrigin, PHP_URL_PORT);
        if (is_int($declaredPort) && ($declaredPort < 1 || $declaredPort > 65535)) {
            continue;
        }

        $declaredOriginHosts[] = $declaredHost;

        $isDefaultPort = (strtolower($declaredScheme) === 'http' && $declaredPort === 80)
            || (strtolower($declaredScheme) === 'https' && $declaredPort === 443);

        // Browsers omit default ports from the Origin/Referer headers, but a
        // custom port must match exactly (host:port) inside Sanctum.
        if (is_int($declaredPort) && ! $isDefaultPort) {
            $declaredOriginHosts[] = "{$declaredHost}:{$declaredPort}";
        }
    }
}

$configuredStatefulDomains = array_values(array_unique(array_filter(
    array_merge($configuredStatefulDomains, $declaredOriginHosts)
)));

$resolvedStatefulDomains = env('APP_ENV') === 'production'
    ? $configuredStatefulDomains
    : array_values(array_unique(array_filter(array_merge($defaultLocalStatefulDomains, $configuredStatefulDomains))));

return [

    /*
    |--------------------------------------------------------------------------
    | Stateful Domains
    |--------------------------------------------------------------------------
    |
    | Requests from the following domains / hosts will receive stateful API
    | authentication cookies. Typically, these should include your local
    | and production domains which access your API via a frontend SPA.
    |
    */

    'stateful' => $resolvedStatefulDomains,

    /*
    |--------------------------------------------------------------------------
    | Sanctum Guards
    |--------------------------------------------------------------------------
    |
    | This array contains the authentication guards that will be checked when
    | Sanctum is trying to authenticate a request. If none of these guards
    | are able to authenticate the request, Sanctum will use the bearer
    | token that's present on an incoming request for authentication.
    |
    */

    'guard' => ['web'],

    /*
    |--------------------------------------------------------------------------
    | Expiration Minutes
    |--------------------------------------------------------------------------
    |
    | This value controls the number of minutes until an issued token will be
    | considered expired. This will override any values set in the token's
    | "expires_at" attribute, but first-party sessions are not affected.
    |
    */

    'expiration' => null,

    /*
    |--------------------------------------------------------------------------
    | Token Prefix
    |--------------------------------------------------------------------------
    |
    | Sanctum can prefix new tokens in order to take advantage of numerous
    | security scanning initiatives maintained by open source platforms
    | that notify developers if they commit tokens into repositories.
    |
    | See: https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning
    |
    */

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Middleware
    |--------------------------------------------------------------------------
    |
    | When authenticating your first-party SPA with Sanctum you may need to
    | customize some of the middleware Sanctum uses while processing the
    | request. You may change the middleware listed below as required.
    |
    */

    'middleware' => [
        // Local demo can opt out while production stays fail-closed by default.
        'authenticate_session' => AuthenticateSession::class,
        'encrypt_cookies' => EncryptCookies::class,
        'validate_csrf_token' => ValidateCsrfToken::class,
    ],

];
