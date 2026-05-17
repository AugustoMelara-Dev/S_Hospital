<?php

namespace App\Http\Controllers;

use App\Http\Requests\Fiscal\StoreFiscalSequenceRequest;
use App\Http\Requests\Fiscal\UpdateFiscalSequenceRequest;
use App\Models\FiscalSequence;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FiscalSequenceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->user()->can('settings.fiscal.view') || abort(403);

        return response()->json([
            'data' => FiscalSequence::query()
                ->orderByDesc('active')
                ->orderBy('document_type')
                ->orderByDesc('id')
                ->get(),
        ]);
    }

    public function store(StoreFiscalSequenceRequest $request): JsonResponse
    {
        $sequence = FiscalSequence::query()->create([
            ...$request->validated(),
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json([
            'data' => $sequence,
        ], 201);
    }

    public function update(UpdateFiscalSequenceRequest $request, FiscalSequence $fiscalSequence): JsonResponse
    {
        $fiscalSequence->fill($request->validated());
        $fiscalSequence->updated_by = $request->user()->id;
        $fiscalSequence->save();

        return response()->json([
            'data' => $fiscalSequence->refresh(),
        ]);
    }
}
