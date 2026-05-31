<?php

namespace App\Http\Controllers;

use App\Models\Area;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AreaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        ($request->user()->can('catalog.view') || $request->user()->can('reports.managerial.view')) || abort(403);

        $areas = Area::query()
            ->when($request->has('active'), fn ($query) => $query->where('active', $request->boolean('active')))
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $areas,
        ]);
    }
}
