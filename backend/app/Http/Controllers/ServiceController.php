<?php

namespace App\Http\Controllers;

use App\Http\Requests\Catalog\StoreServiceRequest;
use App\Http\Requests\Catalog\UpdateServiceRequest;
use App\Models\AuditLog;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ServiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->user()->can('catalog.view') || abort(403);

        $services = Service::query()
            ->with('category:id,name,slug,active,sort_order')
            ->when($request->filled('search'), function ($query) use ($request): void {
                $query->where('name', 'like', '%'.$request->string('search')->toString().'%');
            })
            ->when($request->filled('category_id'), fn ($query) => $query->where('category_id', $request->integer('category_id')))
            ->when($request->has('active'), fn ($query) => $query->where('active', $request->boolean('active')))
            ->orderBy('name')
            ->paginate((int) $request->integer('per_page', 100));

        return response()->json([
            'data' => $services->items(),
            'meta' => [
                'current_page' => $services->currentPage(),
                'per_page' => $services->perPage(),
                'total' => $services->total(),
            ],
        ]);
    }

    public function store(StoreServiceRequest $request): JsonResponse
    {
        $service = Service::query()->create([
            ...$request->validated(),
            'slug' => Str::slug($request->string('name')),
            'taxable' => $request->boolean('taxable', true),
            'active' => $request->boolean('active', true),
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        $this->audit($request, 'service.created', $service->refresh(), null);

        return response()->json([
            'data' => $service->load('category:id,name,slug,active,sort_order'),
        ], 201);
    }

    public function update(UpdateServiceRequest $request, Service $service): JsonResponse
    {
        $oldValues = $this->auditPayload($service);
        $data = $request->validated();

        if (array_key_exists('name', $data)) {
            $data['slug'] = Str::slug($data['name']);
        }

        $service->fill([
            ...$data,
            'updated_by' => $request->user()->id,
        ])->save();

        $service->refresh();
        $this->audit($request, $this->serviceAction($oldValues, $service), $service, $oldValues);

        return response()->json([
            'data' => $service->load('category:id,name,slug,active,sort_order'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function auditPayload(Service $service): array
    {
        return $service->only([
            'category_id',
            'name',
            'slug',
            'price',
            'taxable',
            'active',
            'special_rule_code',
        ]);
    }

    /**
     * @param  array<string, mixed>  $oldValues
     */
    private function serviceAction(array $oldValues, Service $service): string
    {
        if ((string) $oldValues['price'] !== (string) $service->price) {
            return 'service.price_updated';
        }

        if ((bool) $oldValues['active'] !== (bool) $service->active) {
            return 'service.active_updated';
        }

        return 'service.updated';
    }

    /**
     * @param  array<string, mixed>|null  $oldValues
     */
    private function audit(Request $request, string $action, Service $service, ?array $oldValues): void
    {
        AuditLog::query()->create([
            'user_id' => $request->user()->id,
            'action' => $action,
            'entity_type' => Service::class,
            'entity_id' => $service->id,
            'old_values' => $oldValues,
            'new_values' => $this->auditPayload($service),
        ]);
    }
}
