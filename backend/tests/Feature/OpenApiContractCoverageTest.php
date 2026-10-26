<?php

namespace Tests\Feature;

use App\Actions\Reports\OpenApiExporter;
use Tests\TestCase;

class OpenApiContractCoverageTest extends TestCase
{
    public function test_every_api_route_method_is_documented_without_overwriting_sibling_methods(): void
    {
        $this->assertSame(realpath(__DIR__.'/../..'), realpath(base_path()), 'The contract must use the routes from the tested checkout.');
        $document = app(OpenApiExporter::class)->document(app('router'));
        foreach (app('router')->getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/')) {
                continue;
            }
            foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                $this->assertArrayHasKey(strtolower($method), $document['paths']['/'.$route->uri()] ?? [], $method.' '.$route->uri());
            }
        }
    }

    public function test_core_contracts_have_request_response_types_and_actual_success_codes(): void
    {
        $document = app(OpenApiExporter::class)->document(app('router'));
        $paths = $document['paths'];
        $this->assertArrayHasKey('201', $paths['/api/invoices']['post']['responses']);
        $this->assertArrayHasKey('201', $paths['/api/invoices/{invoice}/payments']['post']['responses']);
        $this->assertArrayHasKey('201', $paths['/api/cash-sessions/open']['post']['responses']);
        $this->assertArrayHasKey('202', $paths['/api/backups']['post']['responses']);
        $this->assertSame('#/components/schemas/StoreInvoice', $paths['/api/invoices']['post']['requestBody']['content']['application/json']['schema']['$ref']);
        $this->assertSame('#/components/schemas/InvoiceEnvelope', $paths['/api/invoices']['post']['responses']['201']['content']['application/json']['schema']['$ref']);
        $this->assertSame('integer', $document['components']['schemas']['Invoice']['properties']['total_cents']['type']);
        $this->assertSame('#/components/schemas/Money', $document['components']['schemas']['Invoice']['properties']['total']['$ref']);
        $this->assertArrayHasKey('service_name', $document['components']['schemas']['InvoiceItem']['properties']);
        $this->assertSame('#/components/schemas/PageMeta', $document['components']['schemas']['InvoicePage']['properties']['meta']['$ref']);
        $this->assertSame('binary', $paths['/api/reports/executive/pdf']['get']['responses']['200']['content']['application/pdf']['schema']['format']);
    }

    public function test_route_middleware_determines_idempotency_and_csrf_headers_and_path_parameters(): void
    {
        $document = app(OpenApiExporter::class)->document(app('router'));
        $paths = $document['paths'];
        $parameters = array_column($paths['/api/invoices/{invoice}/payments']['post']['parameters'], null, 'name');
        $this->assertTrue($parameters['Idempotency-Key']['required']);
        $this->assertSame('#/components/schemas/ValidationError', $paths['/api/invoices/{invoice}/payments']['post']['responses']['428']['content']['application/json']['schema']['$ref']);
        $this->assertSame('path', $parameters['invoice']['in']);
        $this->assertTrue($parameters['X-XSRF-TOKEN']['required']);
        $login = array_column($paths['/api/auth/login']['post']['parameters'], null, 'name');
        $this->assertArrayNotHasKey('Idempotency-Key', $login);
        $this->assertTrue($login['X-XSRF-TOKEN']['required']);
        $this->assertSame((string) config('session.cookie'), $document['components']['securitySchemes']['sanctum-session']['name']);
        $this->assertSame('#/components/schemas/ValidationError', $paths['/api/invoices']['post']['responses']['422']['content']['application/json']['schema']['$ref']);
    }

    public function test_history_search_and_request_correlation_are_documented(): void
    {
        $document = app(OpenApiExporter::class)->document(app('router'));
        $parameters = array_column($document['paths']['/api/cash-sessions/options']['get']['parameters'] ?? [], null, 'name');
        $this->assertTrue($parameters['kind']['required'] ?? false);
        $this->assertSame(['sessions', 'cashiers', 'registers'], $parameters['kind']['schema']['enum']);
        $this->assertSame(50, $parameters['per_page']['schema']['maximum']);
        $this->assertSame('uuid', $document['paths']['/api/invoices']['post']['responses']['500']['headers']['X-Request-ID']['schema']['format']);
        $this->assertArrayHasKey('request_id', $document['components']['schemas']['Error']['properties']);
        $this->assertStringContainsString('RESTORE_RECONCILIATION_PENDING', $document['paths']['/api/invoices']['post']['responses']['409']['description']);
    }

    public function test_all_local_schema_references_resolve_and_path_parameters_are_required(): void
    {
        $document = app(OpenApiExporter::class)->document(app('router'));
        $inspect = function (array $node) use (&$inspect, $document): void {
            foreach ($node as $key => $value) {
                if ($key === '$ref') {
                    $this->assertStringStartsWith('#/components/schemas/', $value);
                    $this->assertArrayHasKey(substr($value, strlen('#/components/schemas/')), $document['components']['schemas']);
                } elseif (is_array($value)) {
                    $inspect($value);
                }
            }
        };
        $inspect($document);
        foreach ($document['paths'] as $path => $operations) {
            foreach ($operations as $operation) {
                preg_match_all('/\{([^}]+)\}/', $path, $matches);
                $parameters = array_column($operation['parameters'] ?? [], null, 'name');
                foreach ($matches[1] as $name) {
                    $this->assertSame('path', $parameters[$name]['in']);
                    $this->assertTrue($parameters[$name]['required']);
                }
            }
        }
    }
}
