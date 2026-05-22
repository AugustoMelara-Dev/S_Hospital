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
        File::put($indexPath, '<!doctype html><html><body><div id="root">Hospital Billing OS</div></body></html>');
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
}
