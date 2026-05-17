<?php

namespace App\Http\Controllers;

use App\Http\Requests\Fiscal\StoreFiscalSequenceRequest;
use App\Http\Requests\Fiscal\UpdateFiscalSequenceRequest;
use App\Models\AuditLog;
use App\Models\FiscalSequence;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
        $sequence = DB::transaction(function () use ($request): FiscalSequence {
            $sequence = FiscalSequence::query()->create([
                ...$request->validated(),
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            AuditLog::query()->create([
                'user_id' => $request->user()->id,
                'action' => 'fiscal_sequence.created',
                'entity_type' => FiscalSequence::class,
                'entity_id' => $sequence->id,
                'old_values' => null,
                'new_values' => $this->auditPayload($sequence),
            ]);

            return $sequence;
        });

        return response()->json([
            'data' => $sequence,
        ], 201);
    }

    public function update(UpdateFiscalSequenceRequest $request, FiscalSequence $fiscalSequence): JsonResponse
    {
        $fiscalSequence = DB::transaction(function () use ($request, $fiscalSequence): FiscalSequence {
            $oldValues = $this->auditPayload($fiscalSequence);

            $fiscalSequence->fill($request->validated());
            $fiscalSequence->updated_by = $request->user()->id;
            $fiscalSequence->save();

            AuditLog::query()->create([
                'user_id' => $request->user()->id,
                'action' => 'fiscal_sequence.updated',
                'entity_type' => FiscalSequence::class,
                'entity_id' => $fiscalSequence->id,
                'old_values' => $oldValues,
                'new_values' => $this->auditPayload($fiscalSequence->refresh()),
            ]);

            return $fiscalSequence->refresh();
        });

        return response()->json([
            'data' => $fiscalSequence->refresh(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function auditPayload(FiscalSequence $sequence): array
    {
        return $sequence->only([
            'document_type',
            'prefix',
            'min_number',
            'max_number',
            'current_number',
            'cai',
            'valid_until',
            'active',
        ]);
    }
}
