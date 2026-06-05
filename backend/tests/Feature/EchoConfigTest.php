<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

class EchoConfigTest extends TestCase
{
    public function test_echo_config_returns_app_url_origin_for_websocket_path(): void
    {
        config()->set('app.url', 'https://192.168.1.10:8443');
        config()->set('broadcasting.default', 'pusher');
        config()->set('broadcasting.connections.pusher.options.port', 6001);
        config()->set('broadcasting.connections.pusher.options.scheme', 'http');

        $response = $this->getJson('/api/system/echo-config');

        $response
            ->assertOk()
            ->assertJsonPath('data.driver', 'pusher')
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.host', '192.168.1.10')
            ->assertJsonPath('data.port', 8443)
            ->assertJsonPath('data.scheme', 'https')
            ->assertJsonPath('data.useTLS', true)
            ->assertJsonPath('data.path', '/ws')
            ->assertJsonPath('data.authEndpoint', '/api/broadcasting/auth');
    }

    public function test_echo_config_uses_http_when_app_url_is_http(): void
    {
        config()->set('app.url', 'http://localhost:8000');
        config()->set('broadcasting.default', 'pusher');

        $response = $this->getJson('/api/system/echo-config');

        $response
            ->assertOk()
            ->assertJsonPath('data.scheme', 'http')
            ->assertJsonPath('data.useTLS', false)
            ->assertJsonPath('data.port', 8000)
            ->assertJsonPath('data.path', '/ws');
    }

    public function test_echo_config_disables_websocket_when_broadcasting_is_log(): void
    {
        config()->set('app.url', 'https://192.168.1.10:8443');
        config()->set('broadcasting.default', 'log');

        $response = $this->getJson('/api/system/echo-config');

        $response
            ->assertOk()
            ->assertJsonPath('data.enabled', false);
    }

    public function test_echo_config_keeps_internal_soketi_metadata_separate(): void
    {
        config()->set('app.url', 'https://192.168.1.10:8443');
        config()->set('broadcasting.default', 'pusher');
        config()->set('broadcasting.connections.pusher.options.port', 6001);

        $response = $this->getJson('/api/system/echo-config');

        $response
            ->assertOk()
            ->assertJsonPath('data._internal.port', 6001);
    }
}
