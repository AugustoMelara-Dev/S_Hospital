<?php

namespace App\Http\Controllers;

use App\Http\Requests\Fiscal\DestroyTaxRateRequest;
use App\Http\Requests\Fiscal\IndexTaxRatesRequest;
use App\Http\Requests\Fiscal\StoreTaxRateRequest;
use App\Http\Requests\Fiscal\UpdateTaxRateRequest;
use App\Models\TaxRate;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Configurable tax rates (H-15). The default rate lives in `fiscal_settings`
 * for backwards compatibility; this catalog lets each hospital define the
 * rates it actually uses and assign them per product.
 */
class TaxRateController extends Controller
{
    public function index(IndexTaxRatesRequest $request): JsonResponse
    {
        $query = TaxRate::query()
            ->orderByDesc('is_default')
            ->orderBy('percentage')
            ->orderBy('name');

        if ($request->boolean('active_only')) {
            $query->where('active', true);
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function store(StoreTaxRateRequest $request, AuditLogger $auditLogger): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $validated = $request->validated();
        $reason = $this->stringValue($validated['reason'] ?? null);

        $taxRate = DB::transaction(function () use ($validated, $user, $reason, $request): TaxRate {
            $isDefault = ($validated['is_default'] ?? false) === true;

            if ($isDefault) {
                TaxRate::query()
                    ->where('is_default', true)
                    ->update(['is_default' => false, 'updated_by' => $user->id]);
            }

            $taxRate = TaxRate::query()->create([
                'name' => $this->stringValue($validated['name'] ?? null),
                'percentage' => $this->percentage($this->floatValue($validated['percentage'] ?? null)),
                'active' => ($validated['active'] ?? true) === true,
                'is_default' => $isDefault,
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);

            AuditLogger::log(
                action: 'tax_rate.created',
                entity: $taxRate,
                user: $user,
                request: $request,
                oldValues: [],
                newValues: $taxRate->only(['name', 'percentage', 'active', 'is_default']),
                reason: $reason,
            );

            return $taxRate;
        });

        return response()->json(['data' => $taxRate], 201);
    }

    public function update(UpdateTaxRateRequest $request, TaxRate $taxRate, AuditLogger $auditLogger): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $validated = $request->validated();
        $reason = $this->stringValue($validated['reason'] ?? null);

        $taxRate = DB::transaction(function () use ($request, $taxRate, $validated, $user, $reason): TaxRate {
            $oldValues = $taxRate->only(['name', 'percentage', 'active', 'is_default']);
            $isDefault = ($validated['is_default'] ?? $taxRate->is_default) === true;

            if ($isDefault) {
                TaxRate::query()
                    ->whereKeyNot($taxRate->id)
                    ->where('is_default', true)
                    ->update(['is_default' => false, 'updated_by' => $user->id]);
            }

            $taxRate->fill([
                'name' => $this->stringValue($validated['name'] ?? null),
                'percentage' => $this->percentage($this->floatValue($validated['percentage'] ?? null)),
                'active' => ($validated['active'] ?? $taxRate->active) === true,
                'is_default' => $isDefault,
                'updated_by' => $user->id,
            ]);
            $taxRate->save();
            $taxRate->refresh();

            AuditLogger::log(
                action: 'tax_rate.updated',
                entity: $taxRate,
                user: $user,
                request: $request,
                oldValues: $oldValues,
                newValues: $taxRate->only(['name', 'percentage', 'active', 'is_default']),
                reason: $reason,
            );

            return $taxRate;
        });

        return response()->json(['data' => $taxRate]);
    }

    public function destroy(DestroyTaxRateRequest $request, TaxRate $taxRate, AuditLogger $auditLogger): JsonResponse
    {
        if ($taxRate->services()->exists()) {
            return response()->json([
                'message' => 'La tasa esta asignada a servicios. Reasigne esos servicios o desactive la tasa en lugar de eliminarla.',
            ], 422);
        }

        $user = $this->authenticatedUser($request);
        $reason = $this->stringValue($request->validated('reason'));

        DB::transaction(function () use ($request, $taxRate, $user, $reason): void {
            AuditLogger::log(
                action: 'tax_rate.deleted',
                entity: $taxRate,
                user: $user,
                request: $request,
                oldValues: $taxRate->only(['name', 'percentage', 'active', 'is_default']),
                newValues: null,
                reason: $reason,
            );

            $taxRate->delete();
        });

        return response()->json(['data' => ['deleted' => true]]);
    }

    private function percentage(float $value): string
    {
        return number_format($value, 2, '.', '');
    }

    private function stringValue(mixed $value): string
    {
        return is_string($value) ? $value : '';
    }

    private function floatValue(mixed $value): float
    {
        if (is_int($value) || is_float($value)) {
            return (float) $value;
        }

        return is_string($value) && is_numeric($value) ? (float) $value : 0.0;
    }
}
