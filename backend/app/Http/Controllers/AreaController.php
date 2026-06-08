<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Reports\AreaPaidServicesReportService;
use App\Http\Requests\Catalog\IndexAreaRequest;
use App\Http\Requests\Reports\AreaPaidServicesRequest;
use App\Models\Area;
use Illuminate\Http\JsonResponse;

class AreaController extends Controller
{
    public function index(IndexAreaRequest $request): JsonResponse
    {
        $areas = Area::query()
            ->when($request->has('active'), fn ($query) => $query->where('active', $request->boolean('active')))
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $areas,
        ]);
    }

    public function paidServices(AreaPaidServicesRequest $request, Area $area, AreaPaidServicesReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report(
                $area,
                $request->dateFrom(),
                $request->dateTo(),
                $request->page(),
                $request->perPage(),
            ),
        ]);
    }
}
