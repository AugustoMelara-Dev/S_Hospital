<?php

namespace App\Actions\Fiscal;

use App\Models\FiscalSetting;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UpdateFiscalInstitutionAction
{
    public const AUDIT_FIELDS = [
        'hospital_name',
        'rtn',
        'address',
        'phone',
        'slogan',
        'government_line',
        'secretariat_line',
        'receipt_location',
        'receipt_footer_text',
    ];

    public const BOOTSTRAP_FIELDS = [
        'default_tax_rate' => '15.00',
        'receipt_width' => '80mm',
        'primary_color' => 'indigo',
        'receipt_paper_size' => 'half_letter',
    ];

    public function __construct(private readonly AuditLogger $auditLogger) {}

    /**
     * Aplica los campos de identidad institucional sobre FiscalSetting.
     *
     * Es el unico caso de uso canonico de escritura para la identidad
     * institucional. Tanto el endpoint canonico /api/settings/fiscal como
     * el alias legacy /api/settings/institutional-receipts/institution
     * deben delegar aqui para evitar duplicacion de logica y auditoria.
     *
     * @param  array<string, mixed>  $validated
     */
    public function execute(
        User $user,
        array $validated,
        ?Request $request = null,
        ?string $reason = null,
        ?string $receiptTemplateMode = null,
    ): FiscalSetting {
        return DB::transaction(function () use ($user, $validated, $request, $reason, $receiptTemplateMode): FiscalSetting {
            $setting = FiscalSetting::query()->first() ?? new FiscalSetting;
            $settingExisted = $setting->exists;
            $oldValues = $settingExisted ? $setting->only(self::AUDIT_FIELDS) : null;

            if (! $settingExisted) {
                $setting->fill(self::BOOTSTRAP_FIELDS);
                $setting->created_by = $user->id;
            }

            $values = collect($validated)
                ->only(self::AUDIT_FIELDS)
                ->all();
            if (array_key_exists('rtn', $values) && $values['rtn'] === null) {
                $values['rtn'] = '';
            }

            $setting->fill($values);
            if ($receiptTemplateMode !== null) {
                $setting->receipt_template_mode = $receiptTemplateMode;
            }
            $setting->updated_by = $user->id;
            $setting->save();

            $this->auditLogger->log(
                action: $settingExisted ? 'fiscal_settings.updated' : 'fiscal_settings.created',
                entity: $setting,
                user: $user,
                request: $request,
                oldValues: $oldValues,
                newValues: $setting->only(self::AUDIT_FIELDS),
                reason: $reason,
            );

            return $setting->refresh();
        });
    }
}
