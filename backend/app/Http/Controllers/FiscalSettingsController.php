<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Fiscal\ShowFiscalSettingsRequest;
use App\Http\Requests\Fiscal\UpdateFiscalSettingsRequest;
use App\Models\AuditLog;
use App\Models\FiscalSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class FiscalSettingsController extends Controller
{
    public function show(ShowFiscalSettingsRequest $request): JsonResponse
    {
        return response()->json([
            'data' => FiscalSetting::query()->first(),
        ]);
    }

    public function publicBranding(): JsonResponse
    {
        $setting = FiscalSetting::query()->first();

        return response()->json([
            'data' => $setting ? [
                'hospital_name' => $setting->hospital_name,
                'primary_color' => $setting->primary_color,
                'slogan' => $setting->slogan,
                'government_line' => $setting->government_line,
                'secretariat_line' => $setting->secretariat_line,
                'receipt_location' => $setting->receipt_location,
            ] : null,
        ]);
    }

    public function update(UpdateFiscalSettingsRequest $request): JsonResponse
    {
        $setting = DB::transaction(function () use ($request): FiscalSetting {
            $setting = FiscalSetting::query()->first() ?? new FiscalSetting;
            $fieldsToTrack = [
                'hospital_name',
                'rtn',
                'default_tax_rate',
                'primary_color',
                'address',
                'slogan',
                'scanner_enabled',
                'partial_payments_enabled',
                'receipt_template_mode',
                'receipt_paper_size',
                'government_line',
                'secretariat_line',
                'receipt_location',
                'receipt_footer_text',
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
