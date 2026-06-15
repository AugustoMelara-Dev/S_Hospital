<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

class ProductionSpaRouteTest extends TestCase
{
    public function test_public_spa_routes_serve_frontend_build_when_available(): void
    {
        $distPath = base_path('../frontend/dist');
        $assetsPath = $distPath.'/assets';
        $indexPath = $distPath.'/index.html';
        $manifestPath = $distPath.'/manifest.webmanifest';
        $iconsPath = $distPath.'/icons';
        $iconPath = $iconsPath.'/icon.svg';
        $jsAssetPath = $assetsPath.'/phase10-test.js';
        $cssAssetPath = $assetsPath.'/phase10-test.css';
        $originalIndex = File::exists($indexPath) ? File::get($indexPath) : null;
        $originalManifest = File::exists($manifestPath) ? File::get($manifestPath) : null;
        $originalIcon = File::exists($iconPath) ? File::get($iconPath) : null;
        $originalJsAsset = File::exists($jsAssetPath) ? File::get($jsAssetPath) : null;
        $originalCssAsset = File::exists($cssAssetPath) ? File::get($cssAssetPath) : null;

        File::ensureDirectoryExists($assetsPath);
        File::ensureDirectoryExists($iconsPath);
        File::put($indexPath, '<!doctype html><html><body><div id="root">Sistema de Caja Hospitalaria</div></body></html>');
        File::put($manifestPath, '{"name":"Caja hospitalaria"}');
        File::put($iconPath, '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
        File::put($jsAssetPath, 'console.log("phase10");');
        File::put($cssAssetPath, 'body { color: #111; }');

        try {
            $this->get('/')
                ->assertOk()
                ->assertHeader('X-Content-Type-Options', 'nosniff');

            $this->get('/login')
                ->assertOk()
                ->assertHeader('X-Content-Type-Options', 'nosniff');

            $this->get('/verify-email')
                ->assertOk()
                ->assertHeader('X-Content-Type-Options', 'nosniff');

            foreach ([
                '/dashboard',
                '/billing/new',
                '/cashbox',
                '/catalog',
                '/area-services',
                '/invoices',
                '/reports',
                '/backups',
                '/help',
                '/support',
                '/about',
                '/settings/fiscal',
                '/admin/users',
            ] as $route) {
                $this->get($route)
                    ->assertOk()
                    ->assertHeader('X-Content-Type-Options', 'nosniff');
            }

            $this->get('/assets/phase10-test.js')
                ->assertOk()
                ->assertHeader('Content-Type', 'text/javascript; charset=UTF-8')
                ->assertHeader('X-Content-Type-Options', 'nosniff');

            $this->get('/assets/phase10-test.css')
                ->assertOk()
                ->assertHeader('Content-Type', 'text/css; charset=UTF-8')
                ->assertHeader('X-Content-Type-Options', 'nosniff');

            $this->get('/manifest.webmanifest')
                ->assertOk()
                ->assertHeader('Content-Type', 'application/manifest+json; charset=UTF-8')
                ->assertHeader('X-Content-Type-Options', 'nosniff');

            $this->get('/icons/icon.svg')
                ->assertOk()
                ->assertHeader('Content-Type', 'image/svg+xml')
                ->assertHeader('X-Content-Type-Options', 'nosniff');
        } finally {
            if ($originalIndex === null) {
                File::delete($indexPath);
            } else {
                File::put($indexPath, $originalIndex);
            }

            if ($originalManifest === null) {
                File::delete($manifestPath);
            } else {
                File::put($manifestPath, $originalManifest);
            }

            if ($originalIcon === null) {
                File::delete($iconPath);
            } else {
                File::put($iconPath, $originalIcon);
            }

            if ($originalJsAsset === null) {
                File::delete($jsAssetPath);
            } else {
                File::put($jsAssetPath, $originalJsAsset);
            }

            if ($originalCssAsset === null) {
                File::delete($cssAssetPath);
            } else {
                File::put($cssAssetPath, $originalCssAsset);
            }
        }
    }

    public function test_asset_route_rejects_path_traversal(): void
    {
        $this->get('/assets/../index.html')->assertNotFound();
        $this->get('/assets/%2e%2e/index.html')->assertNotFound();
    }

    public function test_health_route_remains_available(): void
    {
        $this->get('/up')->assertOk();
    }

    public function test_spa_html_substitutes_csp_nonce_placeholder(): void
    {
        $distPath = base_path('../frontend/dist');
        $indexPath = $distPath.'/index.html';
        $originalIndex = File::exists($indexPath) ? File::get($indexPath) : null;

        File::ensureDirectoryExists($distPath);
        File::put($indexPath, '<!doctype html><html><head><meta name="csp-nonce" content="__S_HOSPITAL_CSP_NONCE__"><script nonce="__S_HOSPITAL_CSP_NONCE__" src="/main.js"></script></head><body><div id="root"></div></body></html>');

        try {
            $response = $this->get('/');
            $response->assertOk();

            $body = $response->getContent();
            $csp = (string) $response->headers->get('Content-Security-Policy');

            preg_match("/'nonce-([A-Fa-f0-9]{32})'/", $csp, $matches);
            $this->assertNotEmpty($matches[1] ?? '', 'CSP nonce missing from response header.');

            $expectedNonce = $matches[1];
            $this->assertStringContainsString("<meta name=\"csp-nonce\" content=\"{$expectedNonce}\">", (string) $body);
            $this->assertStringContainsString("<script nonce=\"{$expectedNonce}\" src=\"/main.js\"></script>", (string) $body);
            $this->assertStringNotContainsString('__S_HOSPITAL_CSP_NONCE__', (string) $body);
        } finally {
            if ($originalIndex === null) {
                File::delete($indexPath);
            } else {
                File::put($indexPath, $originalIndex);
            }
        }
    }

    public function test_frontend_source_declares_private_lan_app_metadata(): void
    {
        $indexPath = base_path('../frontend/index.html');
        $manifestPath = base_path('../frontend/public/manifest.webmanifest');
        $robotsPath = base_path('../frontend/public/robots.txt');

        if (! File::exists($indexPath) || ! File::exists($manifestPath) || ! File::exists($robotsPath)) {
            $this->markTestSkipped('Frontend source metadata is validated when the frontend source tree is mounted.');
        }

        $this->assertFileExists($indexPath);
        $this->assertFileExists($manifestPath);
        $this->assertFileExists($robotsPath);

        $index = File::get($indexPath);
        $manifest = json_decode(File::get($manifestPath), true, flags: JSON_THROW_ON_ERROR);
        $robots = File::get($robotsPath);

        $this->assertStringContainsString('<html lang="es"', $index);
        $this->assertStringContainsString('name="description"', $index);
        $this->assertStringContainsString('name="robots" content="noindex,nofollow,noarchive"', $index);
        $this->assertStringContainsString('rel="manifest" href="/manifest.webmanifest"', $index);
        $this->assertStringContainsString('rel="icon" href="/icons/icon.svg"', $index);

        $this->assertSame('Caja hospitalaria', $manifest['name']);
        $this->assertSame('/login', $manifest['start_url']);
        $this->assertSame('standalone', $manifest['display']);
        $this->assertStringContainsString('Disallow: /', $robots);
    }
}
