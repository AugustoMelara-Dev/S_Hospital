<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

class SoketiProxyConfigTest extends TestCase
{
    public function test_nginx_default_conf_proxies_websocket_through_ws_path(): void
    {
        $conf = base_path('nginx/default.conf');
        if (! is_file($conf)) {
            $this->markTestSkipped('nginx/default.conf not present');
        }
        $content = (string) file_get_contents($conf);

        $this->assertStringContainsString('location /ws', $content, 'nginx must proxy /ws for Soketi WebSockets');
        $this->assertStringContainsString('proxy_pass http://soketi:6001', $content, 'nginx /ws must proxy to soketi:6001');
        $this->assertStringContainsString('proxy_set_header Upgrade', $content, 'nginx /ws must forward Upgrade header');
        $this->assertStringContainsString('proxy_set_header Connection "upgrade"', $content, 'nginx /ws must set Connection: upgrade');
        $this->assertStringContainsString('proxy_read_timeout 86400s', $content, 'nginx /ws must extend timeout to 24h');
    }

    public function test_docker_compose_exposes_soketi_only_internally(): void
    {
        $compose = base_path('docker-compose.prod.yml');
        if (! is_file($compose)) {
            $this->markTestSkipped('docker-compose.prod.yml not present');
        }
        $content = (string) file_get_contents($compose);

        // Soketi service block must exist and must NOT publish 6001 on the host.
        $this->assertStringContainsString('soketi:', $content, 'soketi service must exist');
        $this->assertStringContainsString('--host=0.0.0.0', $content, 'soketi must listen on 0.0.0.0 inside the container');
        $this->assertStringContainsString('--port=6001', $content, 'soketi must listen on 6001 inside the container');
        $this->assertStringContainsString('expose:', $content, 'soketi must use expose (not ports) to stay internal');

        // Verify the soketi service block does not contain a `ports:` mapping.
        $soketiBlock = $this->extractServiceBlock($content, 'soketi:');
        $this->assertStringNotContainsString("\n    ports:", $soketiBlock, 'soketi must not publish ports to the host');
    }

    public function test_echo_config_returns_ws_path_for_same_origin(): void
    {
        config()->set('app.url', 'https://192.168.1.10:8443');
        config()->set('broadcasting.default', 'pusher');
        config()->set('broadcasting.connections.pusher.options.port', 6001);

        $response = $this->getJson('/api/system/echo-config');

        $response
            ->assertOk()
            ->assertJsonPath('data.path', '/ws')
            ->assertJsonPath('data.host', '192.168.1.10')
            ->assertJsonPath('data.port', 8443)
            ->assertJsonPath('data.scheme', 'https')
            ->assertJsonPath('data.useTLS', true);
    }

    public function test_echo_config_keeps_internal_soketi_for_cli_and_tests(): void
    {
        config()->set('app.url', 'https://192.168.1.10:8443');
        config()->set('broadcasting.default', 'pusher');
        config()->set('broadcasting.connections.pusher.options.host', 'soketi');
        config()->set('broadcasting.connections.pusher.options.port', 6001);

        $response = $this->getJson('/api/system/echo-config');

        $response
            ->assertOk()
            ->assertJsonPath('data._internal.host', 'soketi')
            ->assertJsonPath('data._internal.port', 6001);
    }

    public function test_lan_emulation_docker_compose_targets_default_network(): void
    {
        $compose = base_path('docker-compose.lan-emulation.yml');
        if (! is_file($compose)) {
            $this->markTestSkipped('docker-compose.lan-emulation.yml not present');
        }
        $content = (string) file_get_contents($compose);

        $this->assertStringContainsString('cashier1', $content, 'lan-emulation must define cashier1');
        $this->assertStringContainsString('cashier5', $content, 'lan-emulation must define cashier5');
        $this->assertStringContainsString('orchestrator', $content, 'lan-emulation must define an orchestrator');
        $this->assertStringContainsString('playwright', $content, 'lan-emulation must use Playwright for the cashier script');
        $this->assertStringContainsString('hospital_default', $content, 'lan-emulation must join the production docker network');
    }

    private function extractServiceBlock(string $compose, string $serviceMarker): string
    {
        $pos = strpos($compose, $serviceMarker);
        if ($pos === false) {
            return '';
        }
        $next = strpos($compose, "\n  ", $pos + strlen($serviceMarker));
        if ($next === false) {
            return substr($compose, $pos);
        }
        return substr($compose, $pos, $next - $pos);
    }
}
