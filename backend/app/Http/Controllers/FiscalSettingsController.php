<?php

namespace App\Http\Controllers;

use App\Http\Requests\Fiscal\ShowFiscalSettingsRequest;
use App\Http\Requests\Fiscal\UpdateFiscalSettingsRequest;
use App\Http\Requests\Fiscal\UpdateOperationalSettingsRequest;
use App\Models\FiscalSetting;
use App\Support\AuditLogger;
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

    public function operational(): JsonResponse
    {
        $setting = FiscalSetting::query()->first();

        return response()->json([
            'data' => $setting ? [
                'default_tax_rate' => $setting->default_tax_rate,
                'scanner_enabled' => $setting->scanner_enabled,
                'partial_payments_enabled' => $setting->partial_payments_enabled,
            ] : null,
        ]);
    }

    public function updateOperational(UpdateOperationalSettingsRequest $request, AuditLogger $auditLogger): JsonResponse
    {
        $fieldsToTrack = ['scanner_enabled', 'partial_payments_enabled'];
        $user = $this->authenticatedUser($request);

        $setting = DB::transaction(function () use ($request, $auditLogger, $fieldsToTrack, $user): FiscalSetting {
            $setting = FiscalSetting::query()->firstOrFail();
            $oldValues = $setting->only($fieldsToTrack);

            $setting->fill($request->validated());
            $setting->updated_by = $user->id;
            $setting->save();
            $setting->refresh();

            $auditLogger->log(
                action: 'operational_settings.updated',
                entity: $setting,
                user: $user,
                request: $request,
                oldValues: $oldValues,
                newValues: $setting->only($fieldsToTrack),
            );

            return $setting;
        });

        return response()->json([
            'data' => [
                'scanner_enabled' => $setting->scanner_enabled,
                'partial_payments_enabled' => $setting->partial_payments_enabled,
            ],
        ]);
    }

    public function update(UpdateFiscalSettingsRequest $request, AuditLogger $auditLogger): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $payload = [
            'setting' => null,
        ];

        $setting = DB::transaction(function () use ($request, $auditLogger, &$payload, $user): FiscalSetting {
            $setting = FiscalSetting::query()->first() ?? new FiscalSetting;
            $settingExisted = $setting->exists;
            $trackableFields = [
                'hospital_name',
                'rtn',
                'default_tax_rate',
                'primary_color',
                'address',
                'phone',
                'slogan',
                'scanner_enabled',
                'partial_payments_enabled',
                'receipt_template_mode',
                'government_line',
                'secretariat_line',
                'receipt_location',
                'receipt_footer_text',
            ];

            $validated = $request->validated();
            unset($validated['reason']);

            $fieldsToTrack = $settingExisted
                ? array_values(array_intersect($trackableFields, array_keys($validated)))
                : $trackableFields;
            $oldValues = $settingExisted ? $setting->only($fieldsToTrack) : null;

            $setting->fill($validated);

            if (! $settingExisted) {
                $setting->created_by = $user->id;
            }

            $setting->updated_by = $user->id;
            $setting->save();

            $auditLogger->log(
                action: $settingExisted ? 'fiscal_settings.updated' : 'fiscal_settings.created',
                entity: $setting,
                user: $user,
                request: $request,
                oldValues: $oldValues,
                newValues: $setting->only($fieldsToTrack),
                reason: $settingExisted ? $request->reason() : null,
            );

            $payload['setting'] = $setting;

            return $setting;
        });

        $responseData = [
            'data' => $setting->refresh(),
        ];

        $response = response()->json($responseData);

        return $response;
    }
}
