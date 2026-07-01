<?php

namespace App\Http\Controllers;

use App\Http\Requests\Fiscal\ShowFiscalSettingsRequest;
use App\Http\Requests\Fiscal\UpdateFiscalSettingsRequest;
use App\Models\CashRegisterSession;
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
                'receipt_paper_size' => $setting->receipt_paper_size,
            ] : null,
        ]);
    }

    public function update(UpdateFiscalSettingsRequest $request, AuditLogger $auditLogger): JsonResponse
    {
        $payload = [
            'setting' => null,
            'paper_size_changed_mid_shift' => false,
            'open_cash_session_id' => null,
        ];

        $setting = DB::transaction(function () use ($request, $auditLogger, &$payload): FiscalSetting {
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
            $previousPaperSize = $setting->receipt_paper_size;

            $setting->fill($request->validated());

            if (! $setting->exists) {
                $setting->created_by = $request->user()->id;
            }

            $setting->updated_by = $request->user()->id;
            $setting->save();

            $auditLogger->log(
                action: $oldValues ? 'fiscal_settings.updated' : 'fiscal_settings.created',
                entity: $setting,
                user: $request->user(),
                request: $request,
                oldValues: $oldValues,
                newValues: $setting->only($fieldsToTrack),
            );

            // Mid-shift paper size changes deserve a separate, auditable
            // trail. The cashier UI surfaces this warning so the operator
            // is aware that receipts already queued may render with the
            // previous profile.
            if (
                $oldValues
                && $previousPaperSize !== $setting->receipt_paper_size
            ) {
                $openSession = CashRegisterSession::query()
                    ->where('status', CashRegisterSession::STATUS_OPEN)
                    ->orderByDesc('id')
                    ->first();

                if ($openSession !== null) {
                    $payload['paper_size_changed_mid_shift'] = true;
                    $payload['open_cash_session_id'] = $openSession->id;

                    $auditLogger->log(
                        action: 'fiscal_settings.paper_size_changed_mid_shift',
                        entity: $setting,
                        user: $request->user(),
                        request: $request,
                        oldValues: ['receipt_paper_size' => $previousPaperSize],
                        newValues: ['receipt_paper_size' => $setting->receipt_paper_size],
                        reason: sprintf(
                            'Cambio de papel con caja abierta (#%d).',
                            $openSession->id,
                        ),
                    );
                }
            }

            $payload['setting'] = $setting;

            return $setting;
        });

        $responseData = [
            'data' => $setting->refresh(),
            'meta' => [
                'paper_size_changed_mid_shift' => $payload['paper_size_changed_mid_shift'],
                'open_cash_session_id' => $payload['open_cash_session_id'],
            ],
        ];

        if ($request->has('receipt_paper_size')) {
            $responseData['warning'] = 'El campo receipt_paper_size en la configuración fiscal está obsoleto y se ha migrado a perfiles de impresión de recibos institucionales.';
            $responseData['_deprecated'] = [
                'receipt_paper_size' => 'Migrado a perfiles de impresión de recibos institucionales.',
            ];
        }

        $response = response()->json($responseData);

        if ($request->has('receipt_paper_size')) {
            $response->headers->set('Warning', '299 - "El campo receipt_paper_size en la configuracion fiscal esta obsoleto y se ha migrado a perfiles de impresion de recibos institucionales."');
        }

        if ($payload['paper_size_changed_mid_shift']) {
            $response->headers->set('X-S-Hospital-Paper-Size-Warning', 'mid-shift-change');
        }

        return $response;
    }
}
