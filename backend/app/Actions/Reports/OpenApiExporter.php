<?php

declare(strict_types=1);

namespace App\Actions\Reports;

use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Routing\Route;
use Illuminate\Routing\Router;

/**
 * Route-derived API inventory with explicit core financial contracts.
 * Export never executes requests, queries business data or changes state.
 */
class OpenApiExporter
{
    /**
     * @var array<string, array{
     *     summary: string,
     *     tags: list<string>,
     *     security: bool,
     *     parameters?: list<string>,
     *     required_parameters?: list<string>
     * }>
     */
    private const ENDPOINTS = [
        '/api/health' => [
            'summary' => 'Liveness probe for the LAN server',
            'tags' => ['system'],
            'security' => false,
        ],
        '/api/system/setup-status' => [
            'summary' => 'One-shot setup status for the authenticated operator wizard',
            'tags' => ['system'],
            'security' => true,
        ],
        '/api/system/status' => [
            'summary' => 'Detailed operational status (env, db, queue, evidence)',
            'tags' => ['system'],
            'security' => true,
        ],
        '/api/system/health' => [
            'summary' => 'Public liveness probe (status, service, version only)',
            'tags' => ['system'],
            'security' => false,
        ],
        '/api/system/health/detail' => [
            'summary' => 'Operational health snapshot (db, queue, backups, storage, errors)',
            'tags' => ['system'],
            'security' => true,
        ],
        '/api/system/csp-report' => [
            'summary' => 'CSP violation report endpoint',
            'tags' => ['system'],
            'security' => false,
        ],
        '/api/settings/logo' => [
            'summary' => 'Read the institucional logo URL',
            'tags' => ['settings'],
            'security' => false,
        ],
        '/api/settings/branding' => [
            'summary' => 'Read the public fiscal branding (no auth)',
            'tags' => ['settings'],
            'security' => false,
        ],
        '/api/auth/login' => [
            'summary' => 'Start an authenticated session and seed the CSRF cookie',
            'tags' => ['auth'],
            'security' => false,
        ],
        '/api/auth/session' => [
            'summary' => 'Return the current session user (or null)',
            'tags' => ['auth'],
            'security' => false,
        ],
        '/api/auth/me' => [
            'summary' => 'Return the current authenticated user payload',
            'tags' => ['auth'],
            'security' => true,
        ],
        '/api/auth/logout' => [
            'summary' => 'Destroy the current session',
            'tags' => ['auth'],
            'security' => true,
        ],
        '/api/auth/change-password' => [
            'summary' => 'Change the current user password (mandatory on first login)',
            'tags' => ['auth'],
            'security' => true,
        ],
        '/api/invoices' => [
            'summary' => 'List and create invoices',
            'tags' => ['invoices'],
            'security' => true,
        ],
        '/api/cash-sessions/current' => [
            'summary' => 'Return the cashier active cash session or null',
            'tags' => ['cash'],
            'security' => true,
        ],
        '/api/backups' => [
            'summary' => 'List or request backups',
            'tags' => ['backups'],
            'security' => true,
        ],
        '/api/reports/dashboard' => [
            'summary' => 'Aggregated dashboard metrics for the cashier landing page',
            'tags' => ['reports'],
            'security' => true,
        ],
        '/api/reports/daily' => [
            'summary' => 'Daily financial facts separated by billed, collected, pending, partial and voided',
            'tags' => ['reports'],
            'security' => true,
            'parameters' => ['date'],
            'required_parameters' => [],
        ],
        '/api/reports/monthly' => [
            'summary' => 'Monthly financial facts and daily evolution',
            'tags' => ['reports'],
            'security' => true,
            'parameters' => ['month'],
            'required_parameters' => [],
        ],
        '/api/reports/income' => [
            'summary' => 'Date-range income report with payment, status, cashier, cash session, area and category filters',
            'tags' => ['reports'],
            'security' => true,
            'parameters' => ['date_from', 'date_to', 'cash_session_id', 'user_id', 'category_id', 'area_id', 'method', 'status'],
            'required_parameters' => ['date_from', 'date_to'],
        ],
        '/api/reports/categories' => [
            'summary' => 'Category breakdown using historical invoice item snapshots and report filters',
            'tags' => ['reports'],
            'security' => true,
            'parameters' => ['date_from', 'date_to', 'cash_session_id', 'user_id', 'category_id', 'area_id', 'method', 'status'],
            'required_parameters' => ['date_from', 'date_to'],
        ],
        '/api/reports/areas' => [
            'summary' => 'Area income breakdown using historical invoice item snapshots and report filters',
            'tags' => ['reports'],
            'security' => true,
            'parameters' => ['date_from', 'date_to', 'cash_session_id', 'user_id', 'category_id', 'area_id', 'method', 'status'],
            'required_parameters' => ['date_from', 'date_to'],
        ],
        '/api/reports/services' => [
            'summary' => 'Service sales breakdown using historical invoice item snapshots and report filters',
            'tags' => ['reports'],
            'security' => true,
            'parameters' => ['date_from', 'date_to', 'cash_session_id', 'user_id', 'category_id', 'area_id', 'method', 'status'],
            'required_parameters' => ['date_from', 'date_to'],
        ],
        '/api/reports/operations' => [
            'summary' => 'Operational audit report for voids, reprints, payment reversals, backups and cashiers',
            'tags' => ['reports'],
            'security' => true,
            'parameters' => ['date_from', 'date_to', 'cash_session_id', 'user_id', 'category_id', 'area_id', 'method', 'status'],
            'required_parameters' => ['date_from', 'date_to'],
        ],
        '/api/reports/export' => [
            'summary' => 'Excel export for date-range financial reports with applied filters',
            'tags' => ['reports'],
            'security' => true,
            'parameters' => ['date_from', 'date_to', 'cash_session_id', 'user_id', 'category_id', 'area_id', 'method', 'status'],
            'required_parameters' => ['date_from', 'date_to'],
        ],
        '/api/reports/pdf' => [
            'summary' => 'Daily or date-range PDF closure export with applied filters',
            'tags' => ['reports'],
            'security' => true,
            'parameters' => ['date', 'date_from', 'date_to', 'cash_session_id', 'user_id', 'category_id', 'area_id', 'method', 'status'],
            'required_parameters' => [],
        ],
        '/api/reports/cash-sessions/{cashSession}' => [
            'summary' => 'Cash session reconciliation with expected cash, counted cash, difference and payment methods',
            'tags' => ['reports'],
            'security' => true,
        ],
        '/api/admin/users' => [
            'summary' => 'List, create and manage users with Spatie roles',
            'tags' => ['admin'],
            'security' => true,
        ],
    ];

    /**
     * @return array<string, mixed>
     */
    public function document(Router $router): array
    {
        $paths = [];

        foreach ($router->getRoutes()->getRoutes() as $route) {
            $path = '/'.ltrim($route->uri(), '/');
            if (! str_starts_with($path, '/api/')) {
                continue;
            }

            $middleware = $route->gatherMiddleware();
            $authenticated = in_array('auth:web', $middleware, true);
            $metadata = self::ENDPOINTS[$path] ?? [
                'summary' => $route->getActionName(),
                'tags' => [$this->tag($path)],
                'security' => $authenticated,
            ];

            $methods = array_values(array_filter(
                $route->methods(),
                static fn (string $method): bool => $method !== 'HEAD',
            ));

            $entry = [];
            foreach ($methods as $method) {
                $entry[strtolower($method)] = [
                    'summary' => $metadata['summary'],
                    'tags' => $metadata['tags'],
                    'security' => $authenticated
                        ? [['sanctum-session' => []]]
                        : [],
                    'responses' => [
                        $this->successCode($route, $method) => $this->successResponse($path, $method),
                        '401' => $this->jsonResponse('Session expired or missing', 'Error'),
                        '403' => $this->jsonResponse('Permission denied or password change required', 'Error'),
                        '404' => $this->jsonResponse('Resource not found', 'Error'),
                        '422' => $this->jsonResponse('Field validation or business rule error', 'ValidationError'),
                        '429' => $this->jsonResponse('Rate limited', 'Error'),
                        '500' => $this->jsonResponse('Unexpected server error; provide request_id to support', 'Error'),
                    ],
                    'x-controller' => $route->getActionName(),
                ];

                $parameters = [];
                foreach ($route->parameterNames() as $parameter) {
                    $parameters[] = ['name' => $parameter, 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer', 'minimum' => 1]];
                }
                if (in_array('idempotency', $middleware, true)) {
                    $parameters[] = ['name' => 'Idempotency-Key', 'in' => 'header', 'required' => true, 'description' => 'Unique key per operation, reused unchanged for retries. Body idempotency_key is a legacy fallback.', 'schema' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 191]];
                    $entry[strtolower($method)]['responses']['409'] = $this->jsonResponse('Operation in progress, key conflict or issuance blocked by post-restore reconciliation (RESTORE_RECONCILIATION_PENDING)', 'Error');
                    $entry[strtolower($method)]['responses']['428'] = $this->jsonResponse('Idempotency key missing, empty or longer than 191 bytes', 'ValidationError');
                }
                if (in_array('web', $middleware, true) && ! in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
                    $parameters[] = ['name' => 'X-XSRF-TOKEN', 'in' => 'header', 'required' => true, 'description' => 'URL-decoded XSRF-TOKEN cookie obtained from GET /sanctum/csrf-cookie on the same origin; send session cookies with credentials.', 'schema' => ['type' => 'string']];
                    $entry[strtolower($method)]['responses']['419'] = $this->jsonResponse('CSRF token expired or missing', 'Error');
                }
                if ($path === '/api/auth/login') {
                    $entry[strtolower($method)]['responses']['423'] = $this->jsonResponse('Account temporarily locked', 'Error');
                }
                $requestSchema = $this->requestSchema($path, $method);
                if ($requestSchema !== null) {
                    $entry[strtolower($method)]['requestBody'] = ['required' => true, 'content' => ['application/json' => ['schema' => $this->ref($requestSchema)]]];
                }

                if (! empty($metadata['parameters'])) {
                    $requiredParameters = $metadata['required_parameters'];

                    $parameters = array_merge($parameters, array_map(
                        fn (string $name): array => $this->queryParameter($name, in_array($name, $requiredParameters, true)),
                        $metadata['parameters'],
                    ));
                }
                if (str_starts_with($path, '/api/reports/executive')) {
                    $parameters = array_merge($parameters, array_map(fn ($name) => $this->queryParameter($name, in_array($name, ['date_from', 'date_to'], true)), ['date_from', 'date_to', 'cash_session_id', 'user_id', 'category_id', 'area_id', 'method', 'status']));
                }
                if ($method === 'GET' && in_array($path, ['/api/invoices', '/api/cash-sessions'], true)) {
                    $parameters = array_merge($parameters, [
                        ['name' => 'page', 'in' => 'query', 'schema' => ['type' => 'integer', 'minimum' => 1]],
                        ['name' => 'per_page', 'in' => 'query', 'schema' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50]],
                    ]);
                    foreach (['date_from', 'date_to', 'user_id', 'status'] as $filter) {
                        $parameters[] = $this->queryParameter($filter);
                    }
                    if ($path === '/api/cash-sessions') {
                        $parameters[] = $this->queryParameter('cash_register_id');
                        $parameters[] = ['name' => 'difference', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['all', 'balanced', 'shortage', 'overage']]];
                        foreach ($parameters as &$parameter) {
                            if ($parameter['name'] === 'status') {
                                $parameter['schema']['enum'] = ['open', 'closed'];
                            }
                        }
                        unset($parameter);
                    }
                }
                if ($path === '/api/cash-sessions/options' && $method === 'GET') {
                    $parameters = array_merge($parameters, [
                        ['name' => 'kind', 'in' => 'query', 'required' => true, 'schema' => ['type' => 'string', 'enum' => ['sessions', 'cashiers', 'registers']]],
                        ['name' => 'search', 'in' => 'query', 'schema' => ['type' => 'string', 'maxLength' => 100]],
                        ['name' => 'page', 'in' => 'query', 'schema' => ['type' => 'integer', 'minimum' => 1]],
                        ['name' => 'per_page', 'in' => 'query', 'schema' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50, 'default' => 20]],
                        $this->queryParameter('selected_id'),
                    ]);
                }
                if ($parameters !== []) {
                    $entry[strtolower($method)]['parameters'] = $parameters;
                }
                foreach ($entry[strtolower($method)]['responses'] as &$response) {
                    $response['headers'] = ['X-Request-ID' => ['description' => 'Server-generated support correlation identifier', 'schema' => ['type' => 'string', 'format' => 'uuid']]];
                }
                unset($response);
            }

            $paths[$path] = array_merge($paths[$path] ?? [], $entry);
        }

        $sessionCookie = config('session.cookie');

        return [
            'openapi' => '3.1.0',
            'info' => [
                'title' => 'Sistema de Caja Hospitalaria API',
                'version' => '1.0.0-rc.3',
                'description' => 'Same-origin API for the cashier / hospital billing app. Hosted on the LAN server, no internet required.',
            ],
            'servers' => [
                ['url' => '/', 'description' => 'Current LAN server origin'],
            ],
            'tags' => [
                ['name' => 'auth', 'description' => 'Session lifecycle and password change'],
                ['name' => 'system', 'description' => 'Health, status and CSP reports'],
                ['name' => 'invoices', 'description' => 'Invoice emission, listing and voiding'],
                ['name' => 'cash', 'description' => 'Cash session open / close / reconciliation'],
                ['name' => 'catalog', 'description' => 'Service and category management'],
                ['name' => 'backups', 'description' => 'Manual and scheduled backup log'],
                ['name' => 'reports', 'description' => 'Operational, financial and fiscal reports'],
                ['name' => 'settings', 'description' => 'Fiscal settings, sequences and branding'],
                ['name' => 'admin', 'description' => 'User and role administration'],
            ],
            'components' => [
                'securitySchemes' => [
                    'sanctum-session' => [
                        'type' => 'apiKey',
                        'in' => 'cookie',
                        'name' => is_string($sessionCookie) ? $sessionCookie : 'laravel_session',
                        'description' => 'Stateful web session. Initialize CSRF using GET /sanctum/csrf-cookie, then POST /api/auth/login with cookies and X-XSRF-TOKEN.',
                    ],
                ],
                'schemas' => $this->schemas(),
            ],
            'paths' => $paths,
        ];
    }

    private function tag(string $path): string
    {
        $segment = explode('/', trim($path, '/'))[1] ?? 'system';

        return match ($segment) {
            'cash-sessions', 'cash-registers' => 'cash',
            'services', 'service-areas', 'categories', 'areas', 'tax-rates' => 'catalog',
            'institutional-receipts', 'payments' => 'invoices',
            'fiscal-sequences' => 'settings',
            default => $segment,
        };
    }

    private function successCode(Route $route, string $method): int
    {
        if ($method !== 'POST') {
            return 200;
        }
        if ($route->uri() === 'api/system/csp-report') {
            return 204;
        }
        if ($route->uri() === 'api/backups') {
            return 202;
        }

        return in_array($route->getActionMethod(), ['store', 'storeSeries', 'printEvent', 'open'], true) ? 201 : 200;
    }

    /** @return array<string, mixed> */
    private function successResponse(string $path, string $method): array
    {
        $mime = match (true) {
            str_ends_with($path, '/pdf'), $path === '/api/reports/pdf' => 'application/pdf',
            str_ends_with($path, '/excel'), $path === '/api/reports/export' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            str_ends_with($path, '/download'), $path === '/api/settings/logo/file' => 'application/octet-stream',
            default => null,
        };
        if ($mime !== null) {
            $content = [$mime => ['schema' => ['type' => 'string', 'format' => 'binary']]];
            if ($path === '/api/institutional-receipts/{receipt}/pdf') {
                $content['text/html'] = ['schema' => ['type' => 'string']];
            }

            return ['description' => 'Binary document download', 'content' => $content];
        }
        if ($path === '/api/system/csp-report') {
            return ['description' => 'Report accepted; no content'];
        }
        $schema = match (true) {
            $path === '/api/invoices' && $method === 'GET' => 'InvoicePage',
            $path === '/api/invoices', $path === '/api/invoices/{invoice}', in_array($path, ['/api/invoices/{invoice}/void', '/api/invoices/{invoice}/reverse'], true) => 'InvoiceEnvelope',
            $path === '/api/invoices/{invoice}/payments' && $method === 'POST' => 'PaymentResult',
            $path === '/api/invoices/{invoice}/payments' => 'PaymentList',
            $path === '/api/cash-sessions' => 'CashSessionPage',
            $path === '/api/cash-sessions/options' => 'CashSessionOptions',
            str_starts_with($path, '/api/cash-sessions/') && ! str_ends_with($path, '/consolidated') => 'CashSessionEnvelope',
            $path === '/api/reports/executive' => 'ExecutiveReportEnvelope',
            default => 'JsonObject',
        };

        return $this->jsonResponse('Successful response', $schema);
    }

    private function requestSchema(string $path, string $method): ?string
    {
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return null;
        }

        return match (true) {
            $path === '/api/invoices' => 'StoreInvoice',
            $path === '/api/invoices/{invoice}/payments' => 'StorePayment',
            $path === '/api/cash-sessions/open' => 'OpenCashSession',
            $path === '/api/cash-sessions/{cashSession}/close' => 'CloseCashSession',
            in_array($path, ['/api/invoices/{invoice}/void', '/api/invoices/{invoice}/reverse'], true) => 'InvoiceReason',
            str_ends_with($path, '/void') && str_contains($path, '/payments/') => 'PaymentReason',
            default => null,
        };
    }

    /** @return array<string, string> */
    private function ref(string $schema): array
    {
        return ['$ref' => '#/components/schemas/'.$schema];
    }

    /** @return array<string, mixed> */
    private function jsonResponse(string $description, string $schema): array
    {
        return ['description' => $description, 'content' => ['application/json' => ['schema' => $this->ref($schema)]]];
    }

    /**
     * Fields below follow FormRequests and Eloquent casts. Additional properties
     * remain allowed because loaded relations and compatibility fields vary.
     * JsonObject deliberately makes no claim about untyped module payloads.
     *
     * @return array<string, mixed>
     */
    private function schemas(): array
    {
        $id = ['type' => 'integer', 'minimum' => 1];
        $text = ['type' => 'string'];
        $nullableText = ['type' => ['string', 'null']];
        $integer = ['type' => 'integer'];
        $decimalInput = ['oneOf' => [['type' => 'string', 'pattern' => '^\\d+(\\.\\d{1,2})?$'], ['type' => 'number', 'minimum' => 0, 'multipleOf' => 0.01]]];
        $positiveDecimalInput = ['oneOf' => [['type' => 'string', 'pattern' => '^(?!0+(?:\\.0{1,2})?$)\\d+(\\.\\d{1,2})?$'], ['type' => 'number', 'minimum' => 0.01, 'multipleOf' => 0.01]]];
        $object = static fn (array $properties, array $required = []): array => ['type' => 'object', 'properties' => $properties] + ($required === [] ? [] : ['required' => $required]);
        $array = static fn (array $items): array => ['type' => 'array', 'items' => $items];
        $envelope = fn (string $schema): array => $object(['data' => $this->ref($schema)], ['data']);
        $money = $this->ref('Money');
        $invoice = ['id' => $id, 'invoice_number' => $text, 'patient_name' => $text,
            'status' => ['type' => 'string', 'enum' => [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL, Invoice::STATUS_PAID, Invoice::STATUS_VOID]],
            'settlement' => ['type' => 'string', 'enum' => [Invoice::SETTLEMENT_PENDING, Invoice::SETTLEMENT_PAID, Invoice::SETTLEMENT_FREE_BY_RULE, Invoice::SETTLEMENT_ZERO_PRICE]],
            'cash_session_id' => ['type' => ['integer', 'null']], 'issued_by' => $id,
            'hospital_name' => $nullableText, 'hospital_rtn' => $nullableText,
            'items' => $array($this->ref('InvoiceItem')), 'payments' => $array($this->ref('Payment'))];
        foreach (['subtotal', 'tax_amount', 'discount_amount', 'total', 'paid_amount', 'balance_due'] as $field) {
            $invoice[$field] = $money;
            $invoice[$field.'_cents'] = $integer;
        }
        $item = ['id' => $id, 'invoice_id' => $id, 'service_id' => ['type' => ['integer', 'null']], 'service_name' => $text, 'category_name' => $text, 'area_name' => $nullableText, 'quantity' => $money, 'special_rule_applied' => ['type' => 'boolean']];
        foreach (['unit_price', 'tax_amount', 'line_subtotal', 'line_total'] as $field) {
            $item[$field] = $money;
            $item[$field.'_cents'] = $integer;
        }
        $item['unit_price_registered_cents'] = $integer;
        $item['rule_adjustment_cents'] = $integer;
        $payment = $object(['id' => $id, 'invoice_id' => $id, 'cash_session_id' => $id, 'user_id' => $id, 'method' => ['type' => 'string', 'enum' => Payment::METHODS], 'status' => ['type' => 'string', 'enum' => [Payment::STATUS_POSTED, Payment::STATUS_VOID]], 'amount' => $money, 'amount_cents' => $integer, 'reference' => $nullableText, 'paid_at' => ['type' => ['string', 'null'], 'format' => 'date-time']]);
        $cash = ['id' => $id, 'user_id' => $id, 'cash_register_id' => ['type' => ['integer', 'null']], 'status' => ['type' => 'string', 'enum' => ['open', 'closed']], 'opening_amount' => $money, 'pending_invoice_count' => $integer];
        foreach (['closing_amount', 'expected_amount', 'difference_amount'] as $field) {
            $cash[$field] = ['anyOf' => [$money, ['type' => 'null']]];
        }
        foreach (['payments_total', 'pending_amount', 'expected_cash_amount'] as $field) {
            $cash[$field] = $money;
        }
        $summary = ['collected_total_cents' => $integer];
        foreach (['billed_total', 'collected_total', 'pending_total', 'voided_total', 'reversed_total', 'average_ticket', 'gratuity_adjustment_total'] as $field) {
            $summary[$field] = $money;
        }
        foreach (['invoice_count', 'receipt_count', 'paid_count', 'partial_count', 'pending_count', 'voided_count', 'without_charge_count', 'gratuity_item_count'] as $field) {
            $summary[$field] = $integer;
        }

        return [
            'JsonObject' => ['type' => 'object', 'description' => 'Module-specific JSON object. See controller identified by x-controller for additional fields.'],
            'Money' => ['type' => 'string', 'pattern' => '^-?\\d+\\.\\d{2}$', 'description' => 'Decimal lempiras as a string; *_cents fields are integer centavos.'],
            'Error' => $object(['message' => $text, 'code' => $text, 'request_id' => ['type' => 'string', 'format' => 'uuid', 'description' => 'Support correlation identifier on operational conflicts and server errors.']]),
            'ValidationError' => $object(['message' => $text, 'errors' => ['type' => 'object', 'additionalProperties' => $array($text)]], ['message', 'errors']),
            'PageMeta' => $object(['current_page' => $integer, 'per_page' => $integer, 'total' => $integer], ['current_page', 'per_page', 'total']),
            'Invoice' => $object($invoice),
            'InvoiceItem' => $object($item) + ['description' => 'Historical service names and prices captured at emission; never recomputed from current catalog.'],
            'Payment' => $payment,
            'CashSession' => $object($cash),
            'InvoiceEnvelope' => $envelope('Invoice'),
            'CashSessionEnvelope' => $object(['data' => ['anyOf' => [$this->ref('CashSession'), ['type' => 'null']]]], ['data']),
            'InvoicePage' => $object(['data' => $array($this->ref('Invoice')), 'meta' => $this->ref('PageMeta')], ['data', 'meta']),
            'CashSessionPage' => $object(['data' => $array($this->ref('CashSession')), 'meta' => $this->ref('PageMeta')], ['data', 'meta']),
            'CashSessionOptions' => $object(['data' => $array($object(['value' => $text, 'label' => $text], ['value', 'label'])), 'meta' => $this->ref('PageMeta'), 'selected' => ['type' => ['object', 'null'], 'properties' => ['value' => $text, 'label' => $text]]], ['data', 'meta', 'selected']),
            'PaymentList' => $object(['data' => $array($this->ref('Payment'))], ['data']),
            'PaymentResult' => $object(['data' => $object(['payment' => $this->ref('Payment'), 'invoice' => $this->ref('Invoice'), 'institutional_receipt' => ['type' => ['object', 'null']], 'institutional_receipt_error' => $nullableText, 'receipt_outcome' => ['type' => 'string', 'enum' => ['issued', 'not_required', 'recovery_required']]])], ['data']),
            'ExecutiveReportEnvelope' => $object(['data' => $object(['period' => $object(['from' => ['type' => 'string', 'format' => 'date'], 'to' => ['type' => 'string', 'format' => 'date'], 'timezone' => $text, 'days' => $integer]), 'summary' => $object($summary), 'filters' => ['type' => 'object']])], ['data']),
            'StoreInvoice' => $object(['patient_name' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 180], 'dialysis_prescription' => ['type' => 'boolean'], 'items' => $array($object(['service_id' => $id, 'quantity' => $positiveDecimalInput, 'notes' => ['type' => ['string', 'null'], 'maxLength' => 255]], ['service_id', 'quantity'])) + ['minItems' => 1, 'maxItems' => 100]], ['patient_name', 'items']),
            'StorePayment' => $object(['cash_session_id' => $id, 'method' => ['type' => 'string', 'enum' => Payment::METHODS], 'amount' => $positiveDecimalInput, 'reference' => ['type' => ['string', 'null'], 'maxLength' => 120, 'description' => 'Required and nonempty when method is card or transfer.']], ['cash_session_id', 'method', 'amount']) + ['description' => 'Amount must be at least 0.01 and may not exceed outstanding balance.'],
            'OpenCashSession' => $object(['opening_amount' => $decimalInput, 'cash_register_id' => $id, 'notes' => ['type' => ['string', 'null'], 'maxLength' => 255]], ['opening_amount']),
            'CloseCashSession' => $object(['closing_amount' => $decimalInput, 'notes' => ['type' => ['string', 'null'], 'maxLength' => 255], 'closing_breakdown' => $object(['bills' => ['type' => 'object', 'properties' => array_fill_keys(['500', '200', '100', '50', '20', '10', '5', '2', '1'], ['type' => 'integer', 'minimum' => 0, 'maximum' => 99999]), 'additionalProperties' => false], 'other_amount' => $decimalInput], ['bills', 'other_amount'])], ['closing_amount']),
            'InvoiceReason' => $object(['reason' => ['type' => 'string', 'minLength' => 5, 'maxLength' => 500]], ['reason']),
            'PaymentReason' => $object(['reason' => ['type' => 'string', 'minLength' => 5, 'maxLength' => 255]], ['reason']),
        ];
    }

    /** @return array<string, mixed> */
    private function queryParameter(string $name, bool $required = false): array
    {
        return [
            'name' => $name,
            'in' => 'query',
            'required' => $required,
            'schema' => $this->queryParameterSchema($name),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function queryParameterSchema(string $name): array
    {
        return match ($name) {
            'date', 'date_from', 'date_to' => ['type' => 'string', 'format' => 'date'],
            'month' => ['type' => 'string', 'pattern' => '^\d{4}-\d{2}$'],
            'cash_session_id', 'cash_register_id', 'selected_id', 'user_id', 'category_id', 'area_id' => ['type' => 'integer', 'minimum' => 1],
            'method' => ['type' => 'string', 'enum' => Payment::METHODS],
            'status' => ['type' => 'string', 'enum' => [
                Invoice::STATUS_ISSUED,
                Invoice::STATUS_PARTIAL,
                Invoice::STATUS_PAID,
                Invoice::STATUS_VOID,
            ]],
            default => ['type' => 'string'],
        };
    }
}
