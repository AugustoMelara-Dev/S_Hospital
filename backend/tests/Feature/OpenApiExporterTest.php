<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Actions\Reports\OpenApiExporter;
use Tests\TestCase;

class OpenApiExporterTest extends TestCase
{
    public function test_document_includes_the_expected_top_level_metadata(): void
    {
        $document = app(OpenApiExporter::class)->document(app('router'));

        $this->assertSame('3.1.0', $document['openapi']);
        $this->assertSame('Sistema de Caja Hospitalaria API', $document['info']['title']);
        $this->assertSame('1.0.0-rc.3', $document['info']['version']);
        $this->assertNotEmpty($document['servers']);
        $this->assertArrayHasKey('paths', $document);
        $this->assertArrayHasKey('securitySchemes', $document['components']);
    }

    public function test_document_lists_the_health_endpoints(): void
    {
        $document = app(OpenApiExporter::class)->document(app('router'));
        $paths = $document['paths'];

        $this->assertArrayHasKey('/api/health', $paths);
        $this->assertArrayHasKey('/api/system/health', $paths);
        $this->assertArrayHasKey('/api/auth/login', $paths);
    }

    public function test_unauthenticated_endpoints_do_not_carry_security(): void
    {
        $document = app(OpenApiExporter::class)->document(app('router'));

        $this->assertSame([], $document['paths']['/api/health']['get']['security']);
        $this->assertSame([], $document['paths']['/api/system/health']['get']['security']);
    }

    public function test_authenticated_endpoints_carry_security(): void
    {
        $document = app(OpenApiExporter::class)->document(app('router'));

        $this->assertNotEmpty($document['paths']['/api/auth/me']['get']['security']);
    }

    public function test_openapi_endpoint_returns_the_document(): void
    {
        $response = $this->getJson('/api/system/openapi');

        $response->assertOk()
            ->assertJsonPath('info.title', 'Sistema de Caja Hospitalaria API')
            ->assertJsonStructure([
                'openapi',
                'info',
                'servers',
                'tags',
                'components',
                'paths',
            ]);
    }

    public function test_tag_list_covers_every_cashier_module(): void
    {
        $document = app(OpenApiExporter::class)->document(app('router'));
        $tagNames = array_column($document['tags'], 'name');

        foreach (['auth', 'system', 'invoices', 'cash', 'catalog', 'backups', 'reports', 'settings', 'admin'] as $expected) {
            $this->assertContains($expected, $tagNames, "OpenAPI tags missing '{$expected}'");
        }
    }

    public function test_every_path_has_a_responses_block(): void
    {
        $document = app(OpenApiExporter::class)->document(app('router'));

        foreach ($document['paths'] as $path => $methods) {
            foreach ($methods as $method => $operation) {
                $this->assertArrayHasKey('responses', $operation, "{$method} {$path} is missing a responses block");
                $this->assertArrayHasKey('200', $operation['responses'], "{$method} {$path} is missing the 200 response");
            }
        }
    }
}
