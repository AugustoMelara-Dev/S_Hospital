<?php

namespace App\Actions\InstitutionalReceipts;

use App\Models\AuditLog;
use App\Models\ReceiptPrintProfile;
use Illuminate\Support\Facades\DB;

/**
 * T-RC-01 — adopt the new compact institutional template on the proposed
 * portrait profiles of an EXISTING installation.
 *
 * C2-B7 — the same guarded adoption also covers the native media carta profile
 * (`media_carta_horizontal`, 215.9 x 139.7 mm = 612 x 396 pt). The historical
 * classic composition was written for a tall sheet, so on a half sheet it flowed
 * over up to seven pages; the native half-sheet composition of the compact family
 * gives media carta its own condensed design (same 14 px / ~10.5 pt detail) instead
 * of reusing the carta composition. The adoption changes ONLY `template_code`.
 *
 * Why this exists
 * ---------------
 * The seeder is insert-only by contract (`firstOrCreate`, so an upgrade never
 * overwrites an admin's configured profile). An installation that was seeded by
 * the previous delivery already owns `carta_vertical` / `a4_vertical` rows whose
 * `template_code` is still the historical `institutional_classic`. Without this
 * step, every NEW receipt on that installation would keep rendering the old
 * composition even though the declared principal design is the new one.
 *
 * What it does (and does not do)
 * ------------------------------
 * - Only the proposed institutional profile codes are considered.
 * - Only a row whose `template_code` is exactly the legacy `institutional_classic`
 *   is adopted; an unknown or explicitly custom template is respected (never
 *   overwritten), and thermal/support-only paper kinds are skipped.
 * - It changes ONLY `template_code`. Paper geometry, margins, orientation and
 *   `copies_mode` stay as the installation configured them, so neither the paper
 *   nor the copy count is ever altered in silence.
 * - Issued receipts are untouched: they keep their own `template_code` snapshot,
 *   so historical documents keep the classic presentation (explicitly proven by
 *   the receipt tests, which request the legacy layout explicitly).
 * - Every adoption is written to `audit_logs` with before/after values, so the
 *   change is traceable rather than silent. It is idempotent.
 */
class AdoptCompactReceiptTemplateAction
{
    public const REASON = 'T-RC-01/C2-B7: adopta la plantilla compacta en los perfiles institucionales propuestos (carta vertical, A4 vertical y media carta nativa) para recibos NUEVOS; no reescribe documentos emitidos ni cambia copias/papel.';

    /**
     * @var list<string>
     */
    private const ADOPTED_PROFILE_CODES = [
        ReceiptPrintProfile::CODE_LETTER_PORTRAIT,
        ReceiptPrintProfile::CODE_A4_PORTRAIT,
        ReceiptPrintProfile::CODE_HALF_LETTER,
    ];

    /**
     * @var list<string>
     */
    private const SUPPORT_PAPER_KINDS = [
        'thermal_80mm',
        'thermal_58mm',
    ];

    /**
     * @return int number of profiles adopted on this run
     */
    public function execute(?int $actorUserId = null): int
    {
        $adopted = 0;

        foreach (self::ADOPTED_PROFILE_CODES as $code) {
            $adopted += $this->adoptCode($code, $actorUserId) ? 1 : 0;
        }

        return $adopted;
    }

    private function adoptCode(string $code, ?int $actorUserId): bool
    {
        return DB::transaction(function () use ($code, $actorUserId): bool {
            $profile = ReceiptPrintProfile::query()
                ->where('code', $code)
                ->lockForUpdate()
                ->first();

            if (! $profile instanceof ReceiptPrintProfile) {
                return false;
            }

            if ($profile->template_code !== InstitutionalReceiptHtmlBuilder::TEMPLATE_CLASSIC) {
                return false;
            }

            if (in_array((string) $profile->paper_kind, self::SUPPORT_PAPER_KINDS, true)) {
                return false;
            }

            $previous = $profile->template_code;

            $profile->forceFill([
                'template_code' => InstitutionalReceiptHtmlBuilder::TEMPLATE_COMPACT,
            ])->save();

            AuditLog::query()->create([
                'user_id' => $actorUserId,
                'action' => 'receipt_print_profile.template_adopted',
                'entity_type' => ReceiptPrintProfile::class,
                'entity_id' => $profile->id,
                'old_values' => ['template_code' => $previous],
                'new_values' => ['template_code' => $profile->template_code],
                'reason' => self::REASON,
            ]);

            return true;
        });
    }
}
