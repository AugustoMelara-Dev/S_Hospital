<?php

namespace App\Http\Controllers;

use App\Http\Requests\Fiscal\UpdateFiscalSettingsRequest;
use App\Models\AuditLog;
use App\Models\FiscalSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FiscalSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $request->user()->can('settings.fiscal.view') || abort(403);

        return response()->json([
            'data' => FiscalSetting::query()->first(),
        ]);
    }

    public function update(UpdateFiscalSettingsRequest $request): JsonResponse
    {
        $setting = DB::transaction(function () use ($request): FiscalSetting {
            $setting = FiscalSetting::query()->firstOrNew(['id' => 1]);
            $fieldsToTrack = [
                'hospital_name',
                'rtn',
                'default_tax_rate',
                'receipt_width',
                'primary_color',
                'address',
                'slogan',
            ];
            $oldValues = $setting->exists ? $setting->only($fieldsToTrack) : null;

            $setting->fill($request->validated());

            if (! $setting->exists) {
                $setting->created_by = $request->user()->id;
            }

            $setting->updated_by = $request->user()->id;
            $setting->save();

            AuditLog::query()->create([
                'user_id' => $request->user()->id,
                'action' => $oldValues ? 'fiscal_settings.updated' : 'fiscal_settings.created',
                'entity_type' => FiscalSetting::class,
                'entity_id' => $setting->id,
                'old_values' => $oldValues,
                'new_values' => $setting->only($fieldsToTrack),
            ]);

            return $setting;
        });

        return response()->json([
            'data' => $setting->refresh(),
        ]);
    }
}
