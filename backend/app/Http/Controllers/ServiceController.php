<?php

namespace App\Http\Controllers;

use App\Http\Requests\Catalog\BulkServiceTaxRequest;
use App\Http\Requests\Catalog\DeleteServiceRequest;
use App\Http\Requests\Catalog\ExportServicesRequest;
use App\Http\Requests\Catalog\ImportServicesRequest;
use App\Http\Requests\Catalog\IndexServiceHistoryRequest;
use App\Http\Requests\Catalog\IndexServiceRequest;
use App\Http\Requests\Catalog\StoreServiceRequest;
use App\Http\Requests\Catalog\UpdateServiceRequest;
use App\Models\Area;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\InvoiceItem;
use App\Models\Service;
use App\Models\ServicePriceHistory;
use App\Models\TaxRate;
use App\Models\User;
use App\Support\ServiceSearch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @phpstan-type ServiceAuditPayload array{
 *     category_id: int,
 *     area_id: int|null,
 *     name: string,
 *     aliases: string|null,
 *     slug: string,
 *     scan_code: string|null,
 *     barcode: string|null,
 *     qr_code: string|null,
 *     description: string|null,
 *     internal_code: string|null,
 *     price: string,
 *     taxable: bool,
 *     tax_rate_id: int|null,
 *     active: bool,
 *     visible_in_billing: bool,
 *     is_billable: bool,
 *     special_rule_code: string|null,
 *     print_on_receipt: bool
 * }
 */
class ServiceController extends Controller
{
    /** @var list<string> */
    private const CATALOG_COLUMNS = [
        'categoria',
        'area',
        'servicio',
        'precio_lps',
        'taxable',
        'tax_rate',
        'tax_rate_percentage',
        'activo',
        'visible_en_cobro',
        'facturable',
        'descripcion',
        'aliases',
        'source_key',
    ];

    /** @var array<string, string> */
    private const CATALOG_HEADER_ALIASES = [
        'precio' => 'precio_lps',
        'precio_l' => 'precio_lps',
        'tasa' => 'tax_rate',
        'tasa_impuesto' => 'tax_rate',
        'impuesto' => 'tax_rate',
        'porcentaje_impuesto' => 'tax_rate_percentage',
        'tax_rate' => 'tax_rate',
        'tax_rate_percentage' => 'tax_rate_percentage',
    ];

    public function index(IndexServiceRequest $request): JsonResponse
    {
        $query = Service::query()
            ->with([
                'category:id,name,slug,active,sort_order',
                'area:id,name,slug,active',
                'taxRate:id,name,percentage,active',
            ])
            ->when($request->filled('code'), function ($query) use ($request): void {
                $code = $request->string('code')->toString();

                $query->where(function ($query) use ($code): void {
                    $query
                        ->where('scan_code', $code)
                        ->orWhere('barcode', $code)
                        ->orWhere('qr_code', $code);
                });
            })
            ->when($request->filled('category_id'), fn ($query) => $query->where('category_id', $request->integer('category_id')))
            ->when($request->filled('area_id'), fn ($query) => $query->where('area_id', $request->integer('area_id')))
            ->when($request->has('active'), fn ($query) => $query->where('active', $request->boolean('active')))
            ->when($request->boolean('billing'), fn ($query) => $query
                ->where('active', true)
                ->where('visible_in_billing', true)
                ->where('is_billable', true)
                ->whereHas('category', fn ($category) => $category->where('active', true)))
            ->when($request->has('visible_in_billing'), fn ($query) => $query->where('visible_in_billing', $request->boolean('visible_in_billing')))
            ->when($request->has('is_billable'), fn ($query) => $query->where('is_billable', $request->boolean('is_billable')));

        $search = trim($request->string('search')->toString());

        if ($search !== '') {
            $exactQuery = clone $query;
            $this->applyExactSearch($exactQuery, $search);

            if ($exactQuery->exists()) {
                $this->applySearchRanking($exactQuery, $search);
                $services = $exactQuery->paginate($request->perPage());
            } else {
                $this->applySearchCandidates($query, $search);
                $services = $this->fuzzySearch($query->limit(250)->get(), $search, $request);
            }
        } else {
            $query->orderBy('name');
            $services = $query->paginate($request->perPage());
        }

        return response()->json([
            'data' => $services->items(),
            'meta' => [
                'current_page' => $services->currentPage(),
                'per_page' => $services->perPage(),
                'total' => $services->total(),
            ],
        ]);
    }

    public function show(Service $service): JsonResponse
    {
        Gate::authorize('view', $service);

        return response()->json([
            'data' => $service->load('category:id,name,slug,active,sort_order', 'area:id,name,slug,active', 'taxRate:id,name,percentage,active'),
        ]);
    }

    public function history(IndexServiceHistoryRequest $request, Service $service): JsonResponse
    {
        $page = AuditLog::query()
            ->with('user:id,name,username')
            ->where('entity_type', Service::class)
            ->where('entity_id', $service->id)
            ->where('action', 'like', 'service.%')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($request->perPage());

        return response()->json([
            'data' => collect($page->items())->map(fn (AuditLog $log): array => [
                'id' => $log->id,
                'action' => $log->action,
                'label' => $this->historyActionLabel($log->action),
                'reason' => $this->historyReason($log),
                'created_at' => $log->created_at?->toIso8601String(),
                'user' => $log->user ? [
                    'id' => $log->user->id,
                    'name' => $log->user->name,
                    'username' => $log->user->username,
                ] : null,
                'changes' => $this->historyChanges($log),
            ])->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /** @param Builder<Service> $query */
    private function applyExactSearch(Builder $query, string $search): void
    {
        $tokens = array_slice(array_values(array_filter(
            explode(' ', ServiceSearch::normalize($search)),
            fn (string $token): bool => $token !== '',
        )), 0, 4);

        foreach ($tokens as $token) {
            $like = '%'.addcslashes($token, '\\%_').'%';

            $query->where(function (Builder $exactQuery) use ($like): void {
                $exactQuery
                    ->where('name', 'like', $like)
                    ->orWhere('slug', 'like', $like)
                    ->orWhere('aliases', 'like', $like)
                    ->orWhere('scan_code', 'like', $like)
                    ->orWhere('barcode', 'like', $like)
                    ->orWhere('qr_code', 'like', $like)
                    ->orWhere('internal_code', 'like', $like)
                    ->orWhereHas('category', fn (Builder $categoryQuery) => $categoryQuery->where('name', 'like', $like))
                    ->orWhereHas('area', fn (Builder $areaQuery) => $areaQuery->where('name', 'like', $like));
            });
        }
    }

    /** @param Builder<Service> $query */
    private function applySearchCandidates(Builder $query, string $search): void
    {
        $tokens = array_slice(array_values(array_filter(
            explode(' ', ServiceSearch::normalize($search)),
            fn (string $token): bool => $token !== '',
        )), 0, 4);

        foreach ($tokens as $token) {
            $length = strlen($token);
            $fragments = $length <= 3
                ? [$token]
                : array_values(array_unique([
                    substr($token, 0, 3),
                    substr($token, max(0, intdiv($length - 3, 2)), 3),
                    substr($token, -3),
                ]));

            $query->where(function (Builder $candidateQuery) use ($fragments): void {
                foreach ($fragments as $fragment) {
                    $like = '%'.addcslashes($fragment, '\\%_').'%';

                    $candidateQuery
                        ->orWhere('name', 'like', $like)
                        ->orWhere('slug', 'like', $like)
                        ->orWhere('aliases', 'like', $like)
                        ->orWhere('scan_code', 'like', $like)
                        ->orWhere('barcode', 'like', $like)
                        ->orWhere('qr_code', 'like', $like)
                        ->orWhere('internal_code', 'like', $like)
                        ->orWhereHas('category', fn (Builder $categoryQuery) => $categoryQuery->where('name', 'like', $like))
                        ->orWhereHas('area', fn (Builder $areaQuery) => $areaQuery->where('name', 'like', $like));
                }
            });
        }
    }

    /** @param Builder<Service> $query */
    private function applySearchRanking(Builder $query, string $search): void
    {
        $needle = ServiceSearch::normalize($search);
        $prefix = $needle.'%';
        $contains = '%'.$needle.'%';

        $query
            ->orderByRaw(
                <<<'SQL'
                    CASE
                        WHEN LOWER(name) = ? THEN 0
                        WHEN LOWER(COALESCE(scan_code, '')) = ?
                          OR LOWER(COALESCE(barcode, '')) = ?
                          OR LOWER(COALESCE(qr_code, '')) = ?
                          OR LOWER(COALESCE(internal_code, '')) = ? THEN 1
                        WHEN LOWER(name) LIKE ? THEN 2
                        WHEN LOWER(COALESCE(aliases, '')) LIKE ? THEN 3
                        WHEN LOWER(name) LIKE ? THEN 4
                        ELSE 5
                    END
                SQL,
                [$needle, $needle, $needle, $needle, $needle, $prefix, $contains, $contains],
            )
            ->orderBy('name');
    }

    /**
     * @param  Collection<int, Service>  $services
     * @return LengthAwarePaginator<int, Service>
     */
    private function fuzzySearch(Collection $services, string $search, IndexServiceRequest $request): LengthAwarePaginator
    {
        $filtered = $services
            ->filter(fn (Service $service): bool => ServiceSearch::matches($service, $search))
            ->values();
        $page = (int) $request->integer('page', 1);
        $perPage = $request->perPage();

        return new LengthAwarePaginator(
            $filtered->forPage($page, $perPage)->values(),
            $filtered->count(),
            $perPage,
            $page,
        );
    }

    public function store(StoreServiceRequest $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        $service = DB::transaction(function () use ($request, $user): Service {
            $data = $request->validated();

            if (array_key_exists('tax_rate_id', $data)) {
                // `services.tax_rate_id` is the source of truth (H-15): NULL is
                // exempt, anything else is taxable. `taxable` is kept in sync
                // for readers that still consult the legacy column.
                $data['taxable'] = $data['tax_rate_id'] !== null;
            }

            $service = Service::query()->create([
                ...$data,
                'slug' => Str::slug($request->string('name')),
                'taxable' => $data['taxable'] ?? $request->boolean('taxable', true),
                'active' => $request->boolean('active', true),
                'visible_in_billing' => $request->boolean('visible_in_billing', true),
                'is_billable' => $request->boolean('is_billable', true),
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);

            $this->audit($user, 'service.created', $service->refresh(), null);

            return $service;
        });

        return response()->json([
            'data' => $service->load('category:id,name,slug,active,sort_order', 'area:id,name,slug,active', 'taxRate:id,name,percentage,active'),
        ], 201);
    }

    public function update(UpdateServiceRequest $request, Service $service): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        $service = DB::transaction(function () use ($request, $service, $user): Service {
            $oldValues = $this->auditPayload($service);
            $data = $request->validated();
            $priceChangeReason = array_key_exists('price_change_reason', $data)
                ? $request->string('price_change_reason')->trim()->toString()
                : null;
            $taxChangeReason = array_key_exists('tax_change_reason', $data)
                ? $request->string('tax_change_reason')->trim()->toString()
                : null;
            $availabilityChangeReason = array_key_exists('availability_change_reason', $data)
                ? $request->string('availability_change_reason')->trim()->toString()
                : null;
            unset($data['price_change_reason']);
            unset($data['tax_change_reason']);
            unset($data['availability_change_reason']);

            if (array_key_exists('tax_rate_id', $data)) {
                $data['taxable'] = $data['tax_rate_id'] !== null;
            }

            // Legacy contract: a client that still sends `taxable: false` means
            // exempt, so the rate must be cleared. Otherwise the model invariant
            // (rate => taxable) would undo the change. New clients send
            // `tax_rate_id` directly.
            if (array_key_exists('taxable', $data)
                && $data['taxable'] === false
                && ! array_key_exists('tax_rate_id', $data)) {
                $data['tax_rate_id'] = null;
            }

            if (array_key_exists('name', $data)) {
                $data['slug'] = Str::slug($request->string('name')->toString());
            }

            $service->fill([
                ...$data,
                'updated_by' => $user->id,
            ])->save();

            $service->refresh();

            foreach ($this->serviceActions($oldValues, $service) as $action) {
                $this->audit(
                    $user,
                    $action,
                    $service,
                    $oldValues,
                    match ($action) {
                        'service.price_updated' => ['price_change_reason' => $priceChangeReason],
                        'service.tax_updated' => ['tax_change_reason' => $taxChangeReason],
                        'service.active_updated', 'service.visibility_updated', 'service.billability_updated' => [
                            'availability_change_reason' => $availabilityChangeReason,
                        ],
                        default => [],
                    },
                );
            }

            if ($oldValues['price'] !== $service->price) {
                ServicePriceHistory::query()->create([
                    'service_id' => $service->id,
                    'old_price' => $oldValues['price'],
                    'new_price' => $service->price,
                    'changed_by' => $user->id,
                    'changed_at' => now(),
                    'reason' => $priceChangeReason,
                ]);
            }

            return $service;
        });

        return response()->json([
            'data' => $service->load('category:id,name,slug,active,sort_order', 'area:id,name,slug,active', 'taxRate:id,name,percentage,active'),
        ]);
    }

    public function destroy(DeleteServiceRequest $request, Service $service): JsonResponse
    {
        Gate::authorize('delete', $service);
        $user = $this->authenticatedUser($request);

        if (InvoiceItem::query()->where('service_id', $service->id)->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar un servicio facturado. Desactive el servicio para ocultarlo de nuevos cobros.',
            ], 409);
        }

        $service = DB::transaction(function () use ($request, $service, $user): Service {
            $oldValues = $this->auditPayload($service);
            $availabilityChangeReason = $request->string('availability_change_reason')->trim()->toString();

            if ($service->active) {
                $service->forceFill([
                    'active' => false,
                    'updated_by' => $user->id,
                ])->save();
                $service->refresh();
            }

            $this->audit($user, 'service.deactivated', $service, $oldValues, [
                'availability_change_reason' => $availabilityChangeReason,
            ]);

            return $service;
        });

        return response()->json([
            'data' => $service->load('category:id,name,slug,active,sort_order', 'area:id,name,slug,active', 'taxRate:id,name,percentage,active'),
        ]);
    }

    /**
     * H-15: assign the same tax rate (or exemption) to a whole category or to
     * an explicit list of services. Existing invoice items are never touched:
     * their `tax_rate` column is the historical snapshot of the issued line.
     */
    public function bulkTax(BulkServiceTaxRequest $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $taxRateId = $request->taxRateId();
        $categoryId = $request->categoryId();
        $serviceIds = $request->serviceIds();
        $reason = $request->reason();

        $updated = DB::transaction(function () use ($user, $taxRateId, $categoryId, $serviceIds, $reason): int {
            $query = Service::query();

            if ($categoryId !== null) {
                $query->where('category_id', $categoryId);
            }

            if ($serviceIds !== []) {
                $query->whereIn('id', $serviceIds);
            }

            /** @var Collection<int, Service> $services */
            $services = $query->lockForUpdate()->get();
            $updated = 0;

            foreach ($services as $service) {
                $oldValues = $this->auditPayload($service);
                $desiredTaxable = $taxRateId !== null;

                if ($oldValues['tax_rate_id'] === $taxRateId && $service->taxable === $desiredTaxable) {
                    continue;
                }

                $service->forceFill([
                    'tax_rate_id' => $taxRateId,
                    'taxable' => $desiredTaxable,
                    'updated_by' => $user->id,
                ])->save();
                $service->refresh();

                $this->audit($user, 'service.tax_updated', $service, $oldValues, [
                    'tax_change_reason' => $reason,
                    'bulk_update' => true,
                    'bulk_category_id' => $categoryId,
                    'bulk_service_ids' => $serviceIds === [] ? null : $serviceIds,
                ], $reason);

                $updated++;
            }

            return $updated;
        });

        return response()->json([
            'data' => ['updated' => $updated],
        ]);
    }

    /**
     * H-16: export the current catalog with its tax rate so it can be edited in
     * a spreadsheet and re-imported into another installation.
     */
    public function export(ExportServicesRequest $request): StreamedResponse
    {
        $query = Service::query()
            ->with([
                'category:id,name',
                'area:id,name',
                'taxRate:id,name,percentage',
            ])
            ->orderBy('category_id')
            ->orderBy('name');

        if ($request->has('active')) {
            $query->where('active', $request->boolean('active'));
        }

        $rows = [];

        foreach ($query->get() as $service) {
            $rows[] = $this->catalogExportRow($service);
        }

        return $request->requestedFormat() === 'xlsx'
            ? $this->streamCatalogXlsx($rows)
            : $this->streamCatalogCsv($rows);
    }

    /**
     * H-16: import a catalog from CSV/XLSX. `preview` only validates; `apply`
     * persists every valid row inside one transaction and reports the rejected
     * lines. Invalid lines never abort the whole file.
     */
    public function import(ImportServicesRequest $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $file = $request->file('file');

        if (! $file instanceof UploadedFile) {
            throw ValidationException::withMessages(['file' => 'Adjunte un archivo CSV o XLSX.']);
        }

        $rows = $this->readCatalogUpload($file);
        $context = $this->importContext();
        $errors = [];
        $valid = [];
        $lineNumbers = [];

        foreach ($rows as $row) {
            $result = $this->validateCatalogImportRow($row['values'], $context);

            if ($result['message'] !== null || $result['payload'] === null) {
                $errors[] = [
                    'line' => $row['line'],
                    'message' => $result['message'] ?? 'No se pudo validar la fila.',
                ];

                continue;
            }

            $valid[] = $result['payload'];
            $lineNumbers[] = $row['line'];
        }

        $applied = 0;

        if ($request->mode() === 'apply' && $valid !== []) {
            $applied = DB::transaction(function () use ($valid, $lineNumbers, &$errors, $user, $request, $file): int {
                $applied = 0;

                foreach ($valid as $index => $payload) {
                    try {
                        $this->applyCatalogImportRow($payload, $user);
                        $applied++;
                    } catch (ValidationException $exception) {
                        $message = collect($exception->errors())->flatten()->first();
                        $errors[] = [
                            'line' => $lineNumbers[$index],
                            'message' => is_string($message) ? $message : 'No se pudo importar la fila.',
                        ];
                    } catch (QueryException) {
                        $errors[] = [
                            'line' => $lineNumbers[$index],
                            'message' => 'La fila entra en conflicto con otro servicio existente.',
                        ];
                    }
                }

                AuditLog::query()->create([
                    'user_id' => $user->id,
                    'action' => 'service.catalog_imported',
                    'result' => 'success',
                    'entity_type' => Service::class,
                    'entity_id' => null,
                    'old_values' => null,
                    'new_values' => [
                        'file' => $file->getClientOriginalName(),
                        'valid' => count($valid),
                        'applied' => $applied,
                        'rejected' => count($errors),
                    ],
                    'reason' => $request->reason(),
                ]);

                return $applied;
            });
        }

        return response()->json([
            'data' => [
                'valid' => count($valid),
                'errors' => $errors,
                'applied' => $applied,
            ],
        ]);
    }

    /**
     * @return array{
     *     rates_by_name: array<string, TaxRate>,
     *     rates_by_percentage: array<int|string, TaxRate>,
     *     default_rate: TaxRate|null,
     *     areas_by_name: array<string, int>
     * }
     */
    private function importContext(): array
    {
        $ratesByName = [];
        $ratesByPercentage = [];

        foreach (TaxRate::query()->orderByDesc('is_default')->orderBy('id')->get() as $rate) {
            $ratesByName[Str::lower(trim($rate->name))] ??= $rate;
            $percentage = number_format((float) $rate->percentage, 2, '.', '');
            $ratesByPercentage[$percentage] ??= $rate;
        }

        $defaultRate = null;

        foreach ($ratesByName as $rate) {
            if ($rate->is_default && $rate->active) {
                $defaultRate = $rate;

                break;
            }
        }

        $areasByName = [];

        foreach (Area::query()->orderBy('id')->get() as $area) {
            $areasByName[Str::lower(trim($area->name))] ??= $area->id;
        }

        return [
            'rates_by_name' => $ratesByName,
            'rates_by_percentage' => $ratesByPercentage,
            'default_rate' => $defaultRate,
            'areas_by_name' => $areasByName,
        ];
    }

    /**
     * @param  array<string, string>  $values
     * @param  array{
     *     rates_by_name: array<string, TaxRate>,
     *     rates_by_percentage: array<int|string, TaxRate>,
     *     default_rate: TaxRate|null,
     *     areas_by_name: array<string, int>
     * }  $context
     * @return array{payload: array<string, mixed>|null, message: string|null}
     */
    private function validateCatalogImportRow(array $values, array $context): array
    {
        $categoryName = trim($values['categoria'] ?? '');
        $serviceName = trim($values['servicio'] ?? '');
        $priceRaw = str_replace(',', '.', trim($values['precio_lps'] ?? ''));

        if ($categoryName === '') {
            return ['payload' => null, 'message' => 'La columna categoria es obligatoria.'];
        }

        if ($serviceName === '') {
            return ['payload' => null, 'message' => 'La columna servicio es obligatoria.'];
        }

        if (! preg_match('/^\d+(\.\d{1,2})?$/', $priceRaw)) {
            return ['payload' => null, 'message' => 'El precio debe ser un decimal positivo con hasta dos decimales.'];
        }

        [$integer, $decimal] = array_pad(explode('.', $priceRaw, 2), 2, '00');
        $price = $integer.'.'.str_pad(substr($decimal, 0, 2), 2, '0');

        $areaName = trim($values['area'] ?? '');
        $areaId = null;

        if ($areaName !== '') {
            $areaId = $context['areas_by_name'][Str::lower($areaName)] ?? null;

            if ($areaId === null) {
                return ['payload' => null, 'message' => "El area [{$areaName}] no existe en la instalacion."];
            }
        }

        $taxableRequested = $this->truthyImportValue($values['taxable'] ?? '');
        $rateName = trim($values['tax_rate'] ?? '');
        $ratePercentageRaw = str_replace(',', '.', trim($values['tax_rate_percentage'] ?? ''));
        $rate = null;

        if ($rateName !== '') {
            $rate = $context['rates_by_name'][Str::lower($rateName)] ?? null;

            if ($rate === null) {
                return ['payload' => null, 'message' => "La tasa de impuesto [{$rateName}] no existe en la instalacion."];
            }

            if (! $rate->active) {
                return ['payload' => null, 'message' => "La tasa de impuesto [{$rateName}] esta inactiva."];
            }

            if ($ratePercentageRaw !== ''
                && $this->normalizedPercentage($ratePercentageRaw) !== number_format((float) $rate->percentage, 2, '.', '')) {
                return ['payload' => null, 'message' => "El porcentaje indicado no coincide con la tasa [{$rateName}]."];
            }
        } elseif ($ratePercentageRaw !== '') {
            if (! preg_match('/^\d+(\.\d{1,2})?$/', $ratePercentageRaw)) {
                return ['payload' => null, 'message' => 'El porcentaje de impuesto no tiene un formato valido.'];
            }

            $percentage = $this->normalizedPercentage($ratePercentageRaw);
            $rate = $context['rates_by_percentage'][$percentage] ?? null;

            if ($rate === null) {
                return ['payload' => null, 'message' => "No existe una tasa activa con porcentaje {$percentage}."];
            }

            if (! $rate->active) {
                return ['payload' => null, 'message' => "La tasa [{$rate->name}] esta inactiva."];
            }
        } elseif ($taxableRequested) {
            $rate = $context['default_rate'];

            if ($rate === null) {
                return ['payload' => null, 'message' => 'El servicio es gravable pero no hay una tasa predeterminada activa.'];
            }
        }

        $taxable = $rate !== null && (float) $rate->percentage > 0;

        return [
            'payload' => [
                'category_name' => $categoryName,
                'category_slug' => Str::slug($categoryName),
                'service_name' => $serviceName,
                'service_slug' => Str::slug($serviceName),
                'price' => $price,
                'area_id' => $areaId,
                'tax_rate_id' => $rate?->id,
                'taxable' => $taxable,
                'active' => $this->truthyImportValue($values['activo'] ?? 'si'),
                'visible_in_billing' => $this->truthyImportValue($values['visible_en_cobro'] ?? 'si'),
                'is_billable' => $this->truthyImportValue($values['facturable'] ?? 'si'),
                'description' => $this->nullableImportValue($values['descripcion'] ?? ''),
                'aliases' => $this->nullableImportValue($values['aliases'] ?? ''),
            ],
            'message' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function applyCatalogImportRow(array $payload, User $user): void
    {
        $categoryName = $this->stringValue($payload['category_name'] ?? null);
        $categorySlug = $this->stringValue($payload['category_slug'] ?? null);
        $serviceName = $this->stringValue($payload['service_name'] ?? null);
        $serviceSlug = $this->stringValue($payload['service_slug'] ?? null);

        $category = Category::query()->where('slug', $categorySlug)->first();

        if ($category === null) {
            $nextSortOrder = $this->intValue(Category::query()->max('sort_order')) + 1;
            $category = Category::query()->create([
                'source_key' => null,
                'name' => $categoryName,
                'slug' => $categorySlug,
                'active' => true,
                'sort_order' => $nextSortOrder,
            ]);
        }

        /** @var int|null $areaId */
        $areaId = $payload['area_id'] ?? null;
        /** @var int|null $taxRateId */
        $taxRateId = $payload['tax_rate_id'] ?? null;

        $service = Service::query()
            ->where('category_id', $category->id)
            ->where(function (Builder $query) use ($areaId): void {
                $areaId === null
                    ? $query->whereNull('area_id')
                    : $query->where('area_id', $areaId);
            })
            ->where('slug', $serviceSlug)
            ->first();

        if ($service === null && $areaId === null) {
            // A third-party CSV may omit the area. Match the existing catalog
            // row by category+slug instead of creating a duplicate, and keep
            // the area the hospital already configured.
            $service = Service::query()
                ->where('category_id', $category->id)
                ->where('slug', $serviceSlug)
                ->first();
        }

        if ($service === null) {
            Service::query()->create([
                'category_id' => $category->id,
                'area_id' => $areaId,
                'name' => $serviceName,
                'slug' => $serviceSlug,
                'price' => $this->stringValue($payload['price'] ?? null),
                'taxable' => ($payload['taxable'] ?? false) === true,
                'tax_rate_id' => $taxRateId,
                'active' => ($payload['active'] ?? true) === true,
                'visible_in_billing' => ($payload['visible_in_billing'] ?? true) === true,
                'is_billable' => ($payload['is_billable'] ?? true) === true,
                'description' => $this->nullableStringValue($payload['description'] ?? null),
                'aliases' => $this->nullableStringValue($payload['aliases'] ?? null),
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);

            return;
        }

        $service->fill([
            'name' => $serviceName,
            'price' => $this->stringValue($payload['price'] ?? null),
            'taxable' => ($payload['taxable'] ?? false) === true,
            'tax_rate_id' => $taxRateId,
            'active' => ($payload['active'] ?? true) === true,
            'visible_in_billing' => ($payload['visible_in_billing'] ?? true) === true,
            'is_billable' => ($payload['is_billable'] ?? true) === true,
            'description' => $this->nullableStringValue($payload['description'] ?? null),
            'updated_by' => $user->id,
        ]);

        $aliases = $this->nullableStringValue($payload['aliases'] ?? null);

        if ($aliases !== null) {
            $service->aliases = $aliases;
        }

        $service->save();
    }

    /**
     * @param  list<list<string>>  $rows
     */
    private function streamCatalogCsv(array $rows): StreamedResponse
    {
        $filename = 'catalogo-servicios-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'wb');

            if ($handle === false) {
                return;
            }

            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, self::CATALOG_COLUMNS);

            foreach ($rows as $row) {
                fputcsv($handle, array_map(
                    fn (string $value): string => $this->formulaSafeValue($value),
                    $row,
                ));
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'max-age=0',
        ]);
    }

    /**
     * @param  list<list<string>>  $rows
     */
    private function streamCatalogXlsx(array $rows): StreamedResponse
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Catalogo');
        $sheet->fromArray(self::CATALOG_COLUMNS, null, 'A1');

        $rowNumber = 2;

        foreach ($rows as $row) {
            foreach ($row as $columnIndex => $value) {
                $coordinate = Coordinate::stringFromColumnIndex($columnIndex + 1).$rowNumber;
                $sheet->setCellValueExplicit(
                    $coordinate,
                    $this->formulaSafeValue($value),
                    DataType::TYPE_STRING,
                );
            }

            $rowNumber++;
        }

        $writer = new Xlsx($spreadsheet);
        $filename = 'catalogo-servicios-'.now()->format('Ymd-His').'.xlsx';

        return response()->streamDownload(function () use ($writer): void {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'max-age=0',
        ]);
    }

    /**
     * @return list<string>
     */
    private function catalogExportRow(Service $service): array
    {
        return [
            (string) $service->category?->name,
            (string) $service->area?->name,
            $service->name,
            (string) $service->price,
            $service->taxable ? 'si' : 'no',
            (string) $service->taxRate?->name,
            $service->taxRate === null ? '' : number_format((float) $service->taxRate->percentage, 2, '.', ''),
            $service->active ? 'si' : 'no',
            $service->visible_in_billing ? 'si' : 'no',
            $service->is_billable ? 'si' : 'no',
            $service->description ?? '',
            $service->aliases ?? '',
            $service->source_key ?? '',
        ];
    }

    /**
     * @return list<array{line: int, values: array<string, string>}>
     */
    private function readCatalogUpload(UploadedFile $file): array
    {
        $extension = Str::lower((string) $file->getClientOriginalExtension());

        return $extension === 'xlsx'
            ? $this->readCatalogSpreadsheet($file)
            : $this->readCatalogCsv($file);
    }

    /**
     * @return list<array{line: int, values: array<string, string>}>
     */
    private function readCatalogCsv(UploadedFile $file): array
    {
        $path = $file->getRealPath();
        $handle = is_string($path) ? fopen($path, 'rb') : false;

        if ($handle === false) {
            throw ValidationException::withMessages(['file' => 'No se pudo leer el archivo CSV.']);
        }

        $headerLine = fgets($handle);
        $delimiter = substr_count((string) $headerLine, ';') > substr_count((string) $headerLine, ',') ? ';' : ',';
        rewind($handle);
        $headerValues = fgetcsv($handle, 0, $delimiter);
        $headers = $this->normalizeCatalogHeaders(is_array($headerValues) ? $headerValues : []);
        $this->assertCatalogHeaders($headers);
        $result = [];
        $line = 1;

        while (($values = fgetcsv($handle, 0, $delimiter)) !== false) {
            $line++;
            $mapped = $this->mapCatalogRow($headers, $values);

            if ($mapped === null) {
                continue;
            }

            $result[] = ['line' => $line, 'values' => $mapped];
        }

        fclose($handle);

        return $result;
    }

    /**
     * @return list<array{line: int, values: array<string, string>}>
     */
    private function readCatalogSpreadsheet(UploadedFile $file): array
    {
        $path = $file->getRealPath();

        if (! is_string($path) || ! is_file($path)) {
            throw ValidationException::withMessages(['file' => 'No se pudo leer el archivo XLSX.']);
        }

        $spreadsheet = IOFactory::load($path);
        /** @var array<int, array<int, mixed>> $allRows */
        $allRows = $spreadsheet->getActiveSheet()->toArray(null, true, false, false);

        if ($allRows === []) {
            throw ValidationException::withMessages(['file' => 'El archivo XLSX esta vacio.']);
        }

        $headerRow = array_shift($allRows);
        $headers = $this->normalizeCatalogHeaders($headerRow);
        $this->assertCatalogHeaders($headers);
        $result = [];
        $line = 1;

        foreach ($allRows as $values) {
            $line++;
            $mapped = $this->mapCatalogRow($headers, $values);

            if ($mapped === null) {
                continue;
            }

            $result[] = ['line' => $line, 'values' => $mapped];
        }

        return $result;
    }

    /**
     * @param  array<int, mixed>  $headerRow
     * @return array<int, string>
     */
    private function normalizeCatalogHeaders(array $headerRow): array
    {
        $headers = [];
        $first = true;

        foreach ($headerRow as $index => $header) {
            $value = is_scalar($header) ? trim((string) $header) : '';

            if ($first) {
                $value = ltrim($value, "\xEF\xBB\xBF");
                $first = false;
            }

            $normalized = str_replace([' ', '-'], '_', Str::lower(Str::ascii($value)));
            $headers[(int) $index] = self::CATALOG_HEADER_ALIASES[$normalized] ?? $normalized;
        }

        return $headers;
    }

    /**
     * @param  array<int, string>  $headers
     */
    private function assertCatalogHeaders(array $headers): void
    {
        $available = array_values($headers);

        foreach (['categoria', 'servicio', 'precio_lps'] as $required) {
            if (! in_array($required, $available, true)) {
                throw ValidationException::withMessages([
                    'file' => "El archivo debe incluir la columna [{$required}]. Consulte la exportacion del catalogo para ver el formato esperado.",
                ]);
            }
        }
    }

    /**
     * @param  array<int, string>  $headers
     * @param  array<int, mixed>  $values
     * @return array<string, string>|null
     */
    private function mapCatalogRow(array $headers, array $values): ?array
    {
        $mapped = [];
        $hasContent = false;

        foreach ($headers as $index => $header) {
            if ($header === '') {
                continue;
            }

            $raw = $values[$index] ?? '';
            $value = is_scalar($raw) ? trim((string) $raw) : '';
            $mapped[$header] = $value;

            if ($value !== '') {
                $hasContent = true;
            }
        }

        return $hasContent ? $mapped : null;
    }

    private function normalizedPercentage(string $value): string
    {
        [$integer, $decimal] = array_pad(explode('.', $value, 2), 2, '00');

        return $integer.'.'.str_pad(substr($decimal, 0, 2), 2, '0');
    }

    private function truthyImportValue(string $value): bool
    {
        return in_array(Str::lower(trim($value)), ['si', 'sí', 'yes', 'true', '1'], true);
    }

    private function nullableImportValue(string $value): ?string
    {
        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function formulaSafeValue(string $value): string
    {
        return preg_match('/^[=+\-@\t\r\n]/', $value) === 1 ? "'".$value : $value;
    }

    private function intValue(mixed $value): int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_float($value)) {
            return (int) $value;
        }

        return is_string($value) && is_numeric($value) ? (int) $value : 0;
    }

    private function stringValue(mixed $value): string
    {
        return is_string($value) ? $value : '';
    }

    private function nullableStringValue(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    /**
     * @return ServiceAuditPayload
     */
    private function auditPayload(Service $service): array
    {
        return [
            'category_id' => $service->category_id,
            'area_id' => $service->area_id,
            'name' => $service->name,
            'aliases' => $service->aliases,
            'slug' => $service->slug,
            'scan_code' => $service->scan_code,
            'barcode' => $service->barcode,
            'qr_code' => $service->qr_code,
            'description' => $service->description,
            'internal_code' => $service->internal_code,
            'price' => $service->price,
            'taxable' => $service->taxable,
            'tax_rate_id' => $service->tax_rate_id,
            'active' => $service->active,
            'visible_in_billing' => $service->visible_in_billing,
            'is_billable' => $service->is_billable,
            'special_rule_code' => $service->special_rule_code,
            'print_on_receipt' => $service->print_on_receipt,
        ];
    }

    /** @return list<array{field: string, label: string, before: mixed, after: mixed}> */
    private function historyChanges(AuditLog $log): array
    {
        $labels = [
            'name' => 'Nombre',
            'aliases' => 'Referencias de búsqueda',
            'price' => 'Precio',
            'taxable' => 'Aplica ISV',
            'tax_rate_id' => 'Tasa de impuesto',
            'active' => 'Activo',
            'visible_in_billing' => 'Visible en caja',
            'is_billable' => 'Facturable',
        ];
        $oldValues = $log->old_values ?? [];
        $newValues = $log->new_values ?? [];
        $changes = [];

        foreach ($labels as $field => $label) {
            $before = $oldValues[$field] ?? null;
            $after = $newValues[$field] ?? null;

            if ($log->old_values !== null && $before === $after) {
                continue;
            }

            $changes[] = compact('field', 'label', 'before', 'after');
        }

        return $changes;
    }

    private function historyReason(AuditLog $log): ?string
    {
        foreach (['price_change_reason', 'tax_change_reason', 'availability_change_reason'] as $field) {
            $value = $log->new_values[$field] ?? null;

            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return $log->reason;
    }

    private function historyActionLabel(string $action): string
    {
        return match ($action) {
            'service.created' => 'Concepto creado',
            'service.price_updated' => 'Precio actualizado',
            'service.tax_updated' => 'Impuesto actualizado',
            'service.active_updated', 'service.deactivated' => 'Disponibilidad actualizada',
            'service.visibility_updated' => 'Visibilidad en caja actualizada',
            'service.billability_updated' => 'Facturación actualizada',
            default => 'Datos actualizados',
        };
    }

    /**
     * @param  ServiceAuditPayload  $oldValues
     * @return non-empty-list<string>
     */
    private function serviceActions(array $oldValues, Service $service): array
    {
        $actions = [];

        if ($oldValues['price'] !== $service->price) {
            $actions[] = 'service.price_updated';
        }

        if ($oldValues['active'] !== $service->active) {
            $actions[] = 'service.active_updated';
        }

        if ($oldValues['taxable'] !== $service->taxable || $oldValues['tax_rate_id'] !== $service->tax_rate_id) {
            $actions[] = 'service.tax_updated';
        }

        if ($oldValues['visible_in_billing'] !== $service->visible_in_billing) {
            $actions[] = 'service.visibility_updated';
        }

        if ($oldValues['is_billable'] !== $service->is_billable) {
            $actions[] = 'service.billability_updated';
        }

        return $actions ?: ['service.updated'];
    }

    /**
     * @param  ServiceAuditPayload|null  $oldValues
     * @param  array<string, mixed>  $extraNewValues
     */
    private function audit(
        User $user,
        string $action,
        Service $service,
        ?array $oldValues,
        array $extraNewValues = [],
        ?string $reason = null,
    ): void {
        AuditLog::query()->create([
            'user_id' => $user->id,
            'action' => $action,
            'entity_type' => Service::class,
            'entity_id' => $service->id,
            'old_values' => $oldValues,
            'new_values' => [
                ...$this->auditPayload($service),
                ...array_filter($extraNewValues, fn ($value): bool => $value !== null && $value !== ''),
            ],
            'reason' => $reason,
        ]);
    }
}
