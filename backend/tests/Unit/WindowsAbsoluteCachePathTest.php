<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use Symfony\Component\Process\Process;

class WindowsAbsoluteCachePathTest extends TestCase
{
    public function test_bootstrap_preserves_windows_drive_qualified_cache_paths(): void
    {
        $paths = [
            'APP_CONFIG_CACHE' => 'x:\\S_Hospital\\cache\\config.php',
            'APP_EVENTS_CACHE' => 'x:/S_Hospital/cache/events.php',
            'APP_PACKAGES_CACHE' => 'Y:\\S_Hospital\\cache\\packages.php',
            'APP_ROUTES_CACHE' => 'Y:/S_Hospital/cache/routes.php',
            'APP_SERVICES_CACHE' => 'Z:\\S_Hospital\\cache\\services.php',
        ];
        $code = <<<'PHP'
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
echo json_encode([
    'APP_CONFIG_CACHE' => $app->getCachedConfigPath(),
    'APP_EVENTS_CACHE' => $app->getCachedEventsPath(),
    'APP_PACKAGES_CACHE' => $app->getCachedPackagesPath(),
    'APP_ROUTES_CACHE' => $app->getCachedRoutesPath(),
    'APP_SERVICES_CACHE' => $app->getCachedServicesPath(),
], JSON_THROW_ON_ERROR);
PHP;

        $process = new Process([PHP_BINARY, '-r', $code], dirname(__DIR__, 2), $paths);
        $process->mustRun();

        $this->assertSame($paths, json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR));
    }
}
