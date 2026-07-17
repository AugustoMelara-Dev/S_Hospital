<?php

namespace App\Http\Controllers;

use App\Http\Requests\Catalog\DeleteServiceRequest;
use App\Http\Requests\Catalog\IndexServiceRequest;
use App\Http\Requests\Catalog\StoreServiceRequest;
use App\Http\Requests\Catalog\UpdateServiceRequest;
use App\Models\AuditLog;
use App\Models\InvoiceItem;
use App\Models\Service;
use App\Models\ServicePriceHistory;
use App\Models\User;
use App\Support\ServiceSearch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

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
 *     active: bool,
 *     visible_in_billing: bool,
 *     is_billable: bool,
 *     special_rule_code: string|null,
 *     print_on_receipt: bool
 * }
 */
class ServiceController extends Controller
{
    public function index(IndexServiceRequest $request): JsonResponse
    {
        $query = Service::query()
            ->with(['category:id,name,slug,active,sort_order', 'area:id,name,slug,active'])
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
            ->when($request->has('is_billable'), fn ($query) => $query->where('is_billable', $request->boolean('is_billable')))
            ->orderBy('name');

        $search = trim($request->string('search')->toString());

        if ($search !== '') {
            $this->applySearchCandidates($query, $search);
        }

        $services = $search !== ''
            ? $this->fuzzySearch($query->get(), $search, $request)
            : $query->paginate($request->perPage());

        return response()->json([
            'data' => $services->items(),
            'meta' => [
                'current_page' => $services->currentPage(),
                'per_page' => $services->perPage(),
                'total' => $services->total(),
            ],
        ]);
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
            $service = Service::query()->create([
                ...$request->validated(),
                'slug' => Str::slug($request->string('name')),
                'taxable' => $request->boolean('taxable', true),
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
            'data' => $service->load('category:id,name,slug,active,sort_order', 'area:id,name,slug,active'),
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
            'data' => $service->load('category:id,name,slug,active,sort_order', 'area:id,name,slug,active'),
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
            'data' => $service->load('category:id,name,slug,active,sort_order', 'area:id,name,slug,active'),
        ]);
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
            'active' => $service->active,
            'visible_in_billing' => $service->visible_in_billing,
            'is_billable' => $service->is_billable,
            'special_rule_code' => $service->special_rule_code,
            'print_on_receipt' => $service->print_on_receipt,
        ];
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

        if ($oldValues['taxable'] !== $service->taxable) {
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
        ]);
    }
}
