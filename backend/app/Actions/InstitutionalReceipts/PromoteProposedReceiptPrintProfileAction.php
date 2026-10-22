<?php

namespace App\Actions\InstitutionalReceipts;

use App\Models\AuditLog;
use App\Models\ReceiptPrintProfile;
use Illuminate\Support\Facades\DB;

/**
 * R2-RCP-01 — effective default profile for NEW institutional receipts.
 *
 * Defect being repaired
 * ---------------------
 * C1-RCP-02 promoted `carta_vertical` (letter portrait, 612 x 792 pt) only on a
 * brand-new catalog. An installation that was already seeded kept
 * `media_carta_horizontal` as its `is_global_default`, so every NEW receipt kept
 * rendering landscape (612 x 396 pt) even though the declared principal design
 * was portrait. The user's real downloaded PDF proved it; a passing test on a
 * separate profile did not.
 *
 * What this action does
 * ---------------------
 * Promotes the proposed principal portrait design (`carta_vertical`) to the
 * single global default for an existing installation, but ONLY when the current
 * declared default is one of the legacy landscape compatibility profiles that
 * this delivery replaces. It never silently rewrites:
 *   - an already-portrait default (an explicit admin choice is respected);
 *   - documents already issued (their `profile_snapshot` is untouched; see
 *     `InstitutionalReceiptPdfService`, which renders from the snapshot);
 *   - any other profile row (geometry, copies_mode, margins stay as configured).
 *
 * It is idempotent: running it twice leaves the same single default. Every
 * mutation is written to `audit_logs` with the before/after values and a reason,
 * so the paper change is traceable rather than silent.
 */
class PromoteProposedReceiptPrintProfileAction
{
    public const REASON = 'R2-RCP-01: adopta carta vertical (612 x 792 pt) como diseno principal propuesto para recibos nuevos; no reescribe documentos emitidos.';

    /**
     * Legacy landscape compatibility defaults. Only these are repointed by the
     * upgrade from the previous landscape-first delivery.
     */
    private const LEGACY_LANDSCAPE_PAPER_KINDS = [
        'half_letter_landscape',
        'letter_landscape',
        'a5_landscape',
    ];

    public function execute(?int $actorUserId = null): ?ReceiptPrintProfile
    {
        $candidate = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->where('active', true)
            ->first();

        if (! $candidate instanceof ReceiptPrintProfile) {
            return null;
        }

        $currentDefault = ReceiptPrintProfile::query()
            ->where('is_global_default', true)
            ->first();

        if ($currentDefault instanceof ReceiptPrintProfile && $currentDefault->is($candidate)) {
            return null;
        }

        // Only a legacy landscape default is repointed. A portrait default (or any
        // other paper kind the admin may have chosen) stays as configured.
        if ($currentDefault instanceof ReceiptPrintProfile
            && ! in_array((string) $currentDefault->paper_kind, self::LEGACY_LANDSCAPE_PAPER_KINDS, true)) {
            return null;
        }

        // No declared default at all: `ResolveReceiptPrintProfileAction` prefers the
        // proposed portrait design as its fallback, so there is nothing to write
        // here and no admin configuration is invented.
        if (! $currentDefault instanceof ReceiptPrintProfile) {
            return null;
        }

        return DB::transaction(function () use ($candidate, $currentDefault, $actorUserId): ReceiptPrintProfile {
            $previous = $this->auditPayload($currentDefault);

            $currentDefault->forceFill(['is_global_default' => false])->save();

            $this->record(
                $actorUserId,
                $currentDefault,
                $previous,
                $this->auditPayload($currentDefault->refresh()),
            );

            $beforeCandidate = $this->auditPayload($candidate);
            $candidate->forceFill(['is_global_default' => true])->save();

            $this->record(
                $actorUserId,
                $candidate,
                $beforeCandidate,
                $this->auditPayload($candidate->refresh()),
            );

            return $candidate->refresh();
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function auditPayload(ReceiptPrintProfile $profile): array
    {
        return $profile->only(['code', 'name', 'paper_kind', 'orientation', 'is_global_default', 'active']);
    }

    /**
     * @param  array<string, mixed>  $oldValues
     * @param  array<string, mixed>  $newValues
     */
    private function record(?int $actorUserId, ReceiptPrintProfile $profile, array $oldValues, array $newValues): void
    {
        AuditLog::query()->create([
            'user_id' => $actorUserId,
            'action' => 'receipt_print_profile.promoted_default',
            'entity_type' => ReceiptPrintProfile::class,
            'entity_id' => $profile->id,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'reason' => self::REASON,
        ]);
    }
}
