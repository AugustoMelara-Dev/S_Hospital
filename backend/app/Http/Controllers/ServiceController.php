<?php

namespace App\Http\Controllers;

use App\Http\Requests\Catalog\IndexServiceRequest;
use App\Http\Requests\Catalog\StoreServiceRequest;
use App\Http\Requests\Catalog\UpdateServiceRequest;
use App\Models\AuditLog;
use App\Models\Service;
use App\Models\ServicePriceHistory;
use App\Support\ServiceSearch;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ServiceController extends Controller
{
    public function index(IndexServiceRequest $request): JsonResponse
    {
        $request->user()->can('catalog.view') || abort(403);

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
                ->where('is_billable', true))
            ->orderBy('name');

        $services = $request->filled('search')
            ? $this->fuzzySearch($query->get(), $request->string('search')->toString(), $request)
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

    /**
     * @param  Collection<int, Service>  $services
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
        $service = DB::transaction(function () use ($request): Service {
            $service = Service::query()->create([
                ...$request->validated(),
                'slug' => Str::slug($request->string('name')),
                'taxable' => $request->boolean('taxable', true),
                'active' => $request->boolean('active', true),
                'visible_in_billing' => $request->boolean('visible_in_billing', true),
                'is_billable' => $request->boolean('is_billable', true),
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            $this->audit($request, 'service.created', $service->refresh(), null);

            return $service;
        });

        return response()->json([
            'data' => $service->load('category:id,name,slug,active,sort_order', 'area:id,name,slug,active'),
        ], 201);
    }

    public function update(UpdateServiceRequest $request, Service $service): JsonResponse
    {
        $service = DB::transaction(function () use ($request, $service): Service {
            $oldValues = $this->auditPayload($service);
            $data = $request->validated();
            $priceChangeReason = array_key_exists('price_change_reason', $data)
                ? trim((string) $data['price_change_reason'])
                : null;
            unset($data['price_change_reason']);

            if (array_key_exists('name', $data)) {
                $data['slug'] = Str::slug($data['name']);
            }

            $service->fill([
                ...$data,
                'updated_by' => $request->user()->id,
            ])->save();

            $service->refresh();

            foreach ($this->serviceActions($oldValues, $service) as $action) {
                $this->audit(
                    $request,
                    $action,
                    $service,
                    $oldValues,
                    $action === 'service.price_updated' ? ['price_change_reason' => $priceChangeReason] : [],
                );
            }

            if ((string) $oldValues['price'] !== (string) $service->price) {
                ServicePriceHistory::query()->create([
                    'service_id' => $service->id,
                    'old_price' => $oldValues['price'],
                    'new_price' => $service->price,
                    'changed_by' => $request->user()->id,
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

    /**
     * @return array<string, mixed>
     */
    private function auditPayload(Service $service): array
    {
        return $service->only([
            'category_id',
            'area_id',
            'name',
            'aliases',
            'slug',
            'scan_code',
            'barcode',
            'qr_code',
            'price',
            'taxable',
            'active',
            'visible_in_billing',
            'is_billable',
            'special_rule_code',
        ]);
    }

    /**
     * @param  array<string, mixed>  $oldValues
     */
    private function serviceActions(array $oldValues, Service $service): array
    {
        $actions = [];

        if ((string) $oldValues['price'] !== (string) $service->price) {
            $actions[] = 'service.price_updated';
        }

        if ((bool) $oldValues['active'] !== (bool) $service->active) {
            $actions[] = 'service.active_updated';
        }

        if ((bool) $oldValues['visible_in_billing'] !== (bool) $service->visible_in_billing) {
            $actions[] = 'service.visibility_updated';
        }

        if ((bool) $oldValues['is_billable'] !== (bool) $service->is_billable) {
            $actions[] = 'service.billability_updated';
        }

        return $actions ?: ['service.updated'];
    }

    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>  $extraNewValues
     */
    private function audit(
        Request $request,
        string $action,
        Service $service,
        ?array $oldValues,
        array $extraNewValues = [],
    ): void {
        AuditLog::query()->create([
            'user_id' => $request->user()->id,
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
