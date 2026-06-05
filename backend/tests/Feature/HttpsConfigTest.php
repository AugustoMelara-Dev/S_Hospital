<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

class HttpsConfigTest extends TestCase
{
    private function projectPath(string $relativePath): string
    {
        return dirname(base_path()).DIRECTORY_SEPARATOR.str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath);
    }

    public function test_env_example_documents_https_ports_without_secrets(): void
    {
        $envExamplePath = $this->projectPath('.env.example');
        if (! is_file($envExamplePath)) {
            $this->markTestSkipped('.env.example not present');
        }

        $content = (string) file_get_contents($envExamplePath);

        $this->assertStringContainsString('APP_HTTP_PORT=80', $content, 'HTTP redirector should default to port 80');
        $this->assertStringContainsString('APP_HTTPS_PORT=443', $content, 'HTTPS should default to port 443');
        $this->assertStringContainsString('HTTPS es obligatorio', $content, 'Template must tell operators HTTPS is required before PRODUCTION_READY');
        $this->assertStringNotContainsString('DB_PASSWORD=Cambio', $content, 'Template must not ship real-looking passwords');
    }

    public function test_docker_compose_prod_marks_https_port_as_published(): void
    {
        $composePath = $this->projectPath('docker-compose.prod.yml');
        if (! is_file($composePath)) {
            $this->markTestSkipped('docker-compose.prod.yml not present');
        }

        $content = (string) file_get_contents($composePath);

        $this->assertStringContainsString('${APP_HTTPS_PORT:-443}:443', $content, 'docker-compose.prod.yml must publish HTTPS with default 443');
        $this->assertStringContainsString('${APP_HTTP_PORT:-80}:80', $content, 'docker-compose.prod.yml must publish the HTTP redirector with default 80');
        $this->assertStringContainsString('APP_URL: https://${SERVER_IP', $content, 'Production APP_URL must be HTTPS');
        $this->assertStringContainsString('SESSION_SECURE_COOKIE: "true"', $content, 'Production sessions must require secure cookies');
        $this->assertStringContainsString('CORS_ALLOWED_ORIGINS: https://${SERVER_IP},https://${SERVER_IP}:${APP_HTTPS_PORT:-443}', $content, 'CORS must allow same-origin HTTPS with and without explicit 443');
        $this->assertStringContainsString("--execute='DB::connection()->getPdo();", $content, 'Queue healthcheck must protect PHP variables from the shell');
        $this->assertStringContainsString('$$worker = DB::table("jobs")', $content, 'Queue healthcheck PHP variables must be escaped for Docker Compose');
        $this->assertStringContainsString('$$failed = DB::table("failed_jobs")', $content, 'Queue healthcheck PHP variables must be escaped for Docker Compose');
        $this->assertStringContainsString('/etc/nginx/ssl', $content, 'docker-compose.prod.yml must mount nginx/ssl into the nginx container');
        $this->assertStringContainsString('hospital-common.conf', $content, 'docker-compose.prod.yml must mount the shared hospital nginx snippet');
    }

    public function test_nginx_default_conf_makes_https_mandatory(): void
    {
        $confPath = $this->projectPath('nginx/default.conf');
        if (! is_file($confPath)) {
            $this->markTestSkipped('nginx/default.conf not present');
        }

        $content = (string) file_get_contents($confPath);

        $this->assertStringContainsString('listen 443 ssl http2', $content, 'HTTPS server block must be present');
        $this->assertStringContainsString('return 301 https://', $content, 'HTTP block must redirect to HTTPS');
        $this->assertStringContainsString('Strict-Transport-Security', $content, 'HSTS header must be set');
        $this->assertStringNotContainsString('include /etc/nginx/snippets/hospital-common.conf;', trim(strstr($content, '# ---- HTTP -> HTTPS redirect', true) ?: ''), 'Common snippet must not be included at nginx http context');
    }

    public function test_nginx_default_conf_proxies_websocket_at_ws_path(): void
    {
        $confPath = $this->projectPath('nginx/default.conf');
        if (! is_file($confPath)) {
            $this->markTestSkipped('nginx/default.conf not present');
        }

        $content = (string) file_get_contents($confPath);

        $this->assertStringContainsString('location /ws/', $content, '/ws location block must exist for Soketi proxy');
        $this->assertStringContainsString('rewrite ^/ws/(.*)$ /$1 break', $content, '/ws must strip the public prefix before proxying to Soketi');
        $this->assertStringContainsString('proxy_pass http://soketi:6001', $content, '/ws must proxy to soketi:6001');
        $this->assertStringContainsString('proxy_set_header Upgrade', $content, 'WebSocket upgrade headers must be forwarded');
    }

    public function test_nginx_common_snippet_includes_forwarded_headers(): void
    {
        $snippetPath = $this->projectPath('nginx/hospital-common.conf');
        if (! is_file($snippetPath)) {
            $this->markTestSkipped('nginx/hospital-common.conf not present');
        }

        $content = (string) file_get_contents($snippetPath);

        $this->assertStringContainsString('HTTP_X_FORWARDED_FOR', $content, 'Common snippet must forward client IP to PHP-FPM');
        $this->assertStringContainsString('HTTP_X_FORWARDED_PROTO', $content, 'Common snippet must forward scheme to PHP-FPM');
        $this->assertStringContainsString('try_files $uri $uri/ /index.html', $content, 'SPA fallback must be present');
    }
}
