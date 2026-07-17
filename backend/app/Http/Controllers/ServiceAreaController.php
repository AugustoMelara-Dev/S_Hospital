<?php

namespace App\Http\Controllers;

use App\Http\Requests\Catalog\StoreServiceAreaRequest;
use App\Http\Requests\Catalog\UpdateServiceAreaRequest;
use App\Models\ServiceArea;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ServiceAreaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authenticatedUser($request)->can('catalog.view') || abort(403);

        $areas = ServiceArea::query()
            ->when($request->has('active'), fn ($query) => $query->where('active', $request->boolean('active')))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $areas]);
    }

    public function store(StoreServiceAreaRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['slug'] = Str::slug($data['name']);

        $area = ServiceArea::query()->create($data);

        return response()->json(['data' => $area], 201);
    }

    public function update(UpdateServiceAreaRequest $request, ServiceArea $serviceArea): JsonResponse
    {
        $data = $request->validated();

        if (array_key_exists('name', $data)) {
            $data['slug'] = Str::slug($data['name']);
        }

        $serviceArea->fill($data)->save();

        return response()->json(['data' => $serviceArea->refresh()]);
    }
}
