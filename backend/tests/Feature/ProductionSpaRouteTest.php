<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

class ProductionSpaRouteTest extends TestCase
{
    public function test_login_and_verify_email_routes_serve_frontend_build_when_available(): void
    {
        $distPath = base_path('../frontend/dist');
        $assetsPath = $distPath.'/assets';
        $indexPath = $distPath.'/index.html';
        $assetPath = $assetsPath.'/phase10-test.js';
        $originalIndex = File::exists($indexPath) ? File::get($indexPath) : null;
        $originalAsset = File::exists($assetPath) ? File::get($assetPath) : null;

        File::ensureDirectoryExists($assetsPath);
        File::put($indexPath, '<!doctype html><html><body><div id="root">Hospital Billing OS</div></body></html>');
        File::put($assetPath, 'console.log("phase10");');

        try {
            $this->get('/login')
                ->assertOk()
                ->assertHeader('X-Content-Type-Options', 'nosniff');

            $this->get('/verify-email')
                ->assertOk()
                ->assertHeader('X-Content-Type-Options', 'nosniff');

            $this->get('/assets/phase10-test.js')
                ->assertOk()
                ->assertHeader('X-Content-Type-Options', 'nosniff');
        } finally {
            if ($originalIndex === null) {
                File::delete($indexPath);
            } else {
                File::put($indexPath, $originalIndex);
            }

            if ($originalAsset === null) {
                File::delete($assetPath);
            } else {
                File::put($assetPath, $originalAsset);
            }
        }
    }

    public function test_asset_route_rejects_path_traversal(): void
    {
        $this->get('/assets/../index.html')->assertNotFound();
        $this->get('/assets/%2e%2e/index.html')->assertNotFound();
    }
}
