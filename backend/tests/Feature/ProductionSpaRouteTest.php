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
        $jsAssetPath = $assetsPath.'/phase10-test.js';
        $cssAssetPath = $assetsPath.'/phase10-test.css';
        $originalIndex = File::exists($indexPath) ? File::get($indexPath) : null;
        $originalJsAsset = File::exists($jsAssetPath) ? File::get($jsAssetPath) : null;
        $originalCssAsset = File::exists($cssAssetPath) ? File::get($cssAssetPath) : null;

        File::ensureDirectoryExists($assetsPath);
        File::put($indexPath, '<!doctype html><html><body><div id="root">Sistema de Caja Hospitalaria</div></body></html>');
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
                '/invoices',
                '/reports',
                '/backups',
                '/help',
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
        } finally {
            if ($originalIndex === null) {
                File::delete($indexPath);
            } else {
                File::put($indexPath, $originalIndex);
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
}
