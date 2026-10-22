<?php

namespace Database\Seeders;

use App\Actions\InstitutionalReceipts\AdoptCompactReceiptTemplateAction;
use App\Actions\InstitutionalReceipts\PromoteProposedReceiptPrintProfileAction;
use App\Models\ReceiptPrintProfile;
use Illuminate\Database\Seeder;

class ReceiptPrintProfileSeeder extends Seeder
{
    /**
     * Seed required institutional receipt paper profiles.
     *
     * Delivery-copy proposal for NEW installations (T-RC-01, 2026-09-18):
     * the proposed principal designs (`carta_vertical`, `a4_vertical`) ship with
     * copies_mode = original_only: ONE patient copy by default. Additional copies
     * are an explicit operator selection, not a mandatory three-document set.
     * The historical landscape `media_carta_horizontal` keeps its legacy
     * original_first_second proposal so old documents render unchanged.
     *
     * This is an explicit, configurable proposal, not a silent policy:
     * - copies_mode remains editable per profile through the settings API/UI
     *   (receipt_settings.update; no advanced permission required).
     * - Every issued receipt snapshots the mode it was issued with, so changing a
     *   profile never rewrites already issued receipts or their historical PDFs.
     * - firstOrCreate() only inserts missing codes: installations that were already
     *   seeded keep their configured profiles and this proposal does not touch them.
     *
     * Global default for NEW installations (C1-RCP-02, mandate §12):
     * - `carta_vertical` (letter_portrait, 215.90 x 279.40 mm = 612 x 792 pt, 12 mm
     *   margins) is the proposed PRINCIPAL institutional design. A brand-new
     *   installation (empty `receipt_print_profiles` catalog before this run) is
     *   left with exactly ONE global default: `carta_vertical`.
     * - `a4_vertical` (a4_portrait, 210 x 297 mm = 595.28 x 841.89 pt, 12 mm
     *   margins) is the configurable A4 alternative. A4 is not a synonym of
     *   letter, media carta or A5 and never replaces them.
     * - Historical landscape and thermal profiles are preserved for old documents;
     *   issued receipts keep the profile snapshot they were issued with.
     * - NEW catalogs get one default here (`promoteProposedGlobalDefault`), which
     *   only runs when the catalog did not exist before this seeder inserted it.
     * - R2-RCP-01 additionally promotes the proposed portrait design on an
     *   EXISTING installation, but only through
     *   `PromoteProposedReceiptPrintProfileAction`: it repoints the declared
     *   default ONLY when that default is a legacy landscape profile, respects an
     *   explicit non-landscape admin choice, never invents a default when none is
     *   declared, is idempotent, writes `audit_logs`, and never rewrites issued
     *   receipts. It is a guarded upgrade, not a silent data migration, and no
     *   migration file flips `is_global_default`.
     *
     * Native `paper_kind` for new installations (2026-09-17):
     * - The enum now includes `letter_portrait` and `a4_portrait`
     *   (migration `2026_09_17_000005_extend_receipt_print_profiles_paper_kind_enum.php`,
     *   owned by hs-db). This seeder inserts the NATIVE values directly.
     * - Existing installations that still held `custom_mm` were repointed by that
     *   same migration; `firstOrCreate` never updates them, so re-running this
     *   seeder is a no-op for them.
     * - `App\Support\PaperSize` resolves both the native kinds and the equivalent
     *   custom_mm geometry through the same mm->pt conversion (one source of
     *   truth; see its unit test).
     */
    public function run(): void
    {
        $profiles = [
            ReceiptPrintProfile::CODE_CUSTOM_SMALL => [
                'code' => ReceiptPrintProfile::CODE_CUSTOM_SMALL,
                'name' => 'Recibo pequeno personalizado',
                'paper_kind' => 'custom_mm',
                'width_mm' => '180.00',
                'height_mm' => '95.00',
                'margin_top_mm' => '5.00',
                'margin_right_mm' => '5.00',
                'margin_bottom_mm' => '5.00',
                'margin_left_mm' => '5.00',
                'orientation' => 'landscape',
                'template_code' => 'institutional_classic',
                'font_family' => 'Arial, sans-serif',
                'font_scale' => '0.95',
                'copies_mode' => 'original_only',
                'show_copy_legend' => true,
                'show_physical_seal_space' => true,
                'use_logo' => false,
                'show_technical_fields' => false,
                'active' => false,
                'is_global_default' => false,
            ],
            ReceiptPrintProfile::CODE_HALF_LETTER => [
                'code' => ReceiptPrintProfile::CODE_HALF_LETTER,
                'name' => 'Media carta horizontal',
                'paper_kind' => 'half_letter_landscape',
                'width_mm' => '215.90',
                'height_mm' => '139.70',
                'margin_top_mm' => '6.00',
                'margin_right_mm' => '6.00',
                'margin_bottom_mm' => '6.00',
                'margin_left_mm' => '6.00',
                'orientation' => 'landscape',
                'template_code' => 'institutional_classic',
                'font_family' => 'Arial, sans-serif',
                'font_scale' => '1.00',
                // Three-copy delivery proposal, now an available layout rather
                // than the seeded global default of new installations.
                'copies_mode' => 'original_first_second',
                'show_copy_legend' => true,
                'show_physical_seal_space' => true,
                'use_logo' => false,
                'show_technical_fields' => false,
                'active' => true,
                // C1-RCP-02: no longer the seeded global default. The promotion
                // step below assigns the single default on brand-new catalogs,
                // and never touches an already configured installation.
                'is_global_default' => false,
            ],
            ReceiptPrintProfile::CODE_A5 => [
                'code' => ReceiptPrintProfile::CODE_A5,
                'name' => 'A5 horizontal',
                'paper_kind' => 'a5_landscape',
                'width_mm' => '210.00',
                'height_mm' => '148.00',
                'margin_top_mm' => '6.00',
                'margin_right_mm' => '6.00',
                'margin_bottom_mm' => '6.00',
                'margin_left_mm' => '6.00',
                'orientation' => 'landscape',
                'template_code' => 'institutional_classic',
                'font_family' => 'Arial, sans-serif',
                'font_scale' => '1.00',
                'copies_mode' => 'original_only',
                'show_copy_legend' => true,
                'show_physical_seal_space' => true,
                'use_logo' => false,
                'show_technical_fields' => false,
                'active' => true,
                'is_global_default' => false,
            ],
            ReceiptPrintProfile::CODE_LETTER => [
                'code' => ReceiptPrintProfile::CODE_LETTER,
                'name' => 'Carta horizontal',
                'paper_kind' => 'letter_landscape',
                'width_mm' => '279.40',
                'height_mm' => '215.90',
                'margin_top_mm' => '8.00',
                'margin_right_mm' => '8.00',
                'margin_bottom_mm' => '8.00',
                'margin_left_mm' => '8.00',
                'orientation' => 'landscape',
                'template_code' => 'institutional_classic',
                'font_family' => 'Arial, sans-serif',
                'font_scale' => '1.00',
                'copies_mode' => 'original_only',
                'show_copy_legend' => true,
                'show_physical_seal_space' => true,
                'use_logo' => false,
                'show_technical_fields' => false,
                'active' => true,
                'is_global_default' => false,
            ],
            ReceiptPrintProfile::CODE_LETTER_PORTRAIT => [
                'code' => ReceiptPrintProfile::CODE_LETTER_PORTRAIT,
                'name' => 'Carta vertical',
                // Native paper_kind since hs-db M-W2-DB-02 extended the enum
                // (2026_09_17_000005). New installations seed the native value
                // directly; existing installations were repointed by that
                // migration. The exact geometry (215.90 x 279.40 mm = 612 x 792 pt)
                // is identical to the previous custom_mm carriage.
                'paper_kind' => 'letter_portrait',
                'width_mm' => '215.90',
                'height_mm' => '279.40',
                'margin_top_mm' => '12.00',
                'margin_right_mm' => '12.00',
                'margin_bottom_mm' => '12.00',
                'margin_left_mm' => '12.00',
                'orientation' => 'portrait',
                // T-RC-01 (mandate §11): the proposed principal design uses the
                // NEW compact institutional template, not the historical classic
                // composition. Issued receipts snapshot this code; existing
                // installations whose portrait row still carries the classic
                // template are adopted by AdoptCompactReceiptTemplateAction.
                'template_code' => 'institutional_compact',
                'font_family' => 'Arial, sans-serif',
                'font_scale' => '1.00',
                // Delivery proposal for NEW installations: ONE patient copy by
                // default. Additional copies are an explicit operator selection
                // (copies_mode remains editable per profile); there is no
                // mandatory three-document set anymore.
                'copies_mode' => 'original_only',
                'show_copy_legend' => true,
                'show_physical_seal_space' => true,
                'use_logo' => false,
                'show_technical_fields' => false,
                'active' => true,
                // Inserted without the flag and promoted afterwards ONLY when the
                // catalog is brand new (see promoteProposedGlobalDefault). This
                // keeps firstOrCreate from producing two defaults on existing
                // installations, where the unique index would reject it.
                'is_global_default' => false,
            ],
            ReceiptPrintProfile::CODE_A4_PORTRAIT => [
                'code' => ReceiptPrintProfile::CODE_A4_PORTRAIT,
                'name' => 'A4 vertical configurable',
                // Native a4_portrait; exact 210 x 297 mm (595.28 x 841.89 pt).
                'paper_kind' => 'a4_portrait',
                'width_mm' => '210.00',
                'height_mm' => '297.00',
                'margin_top_mm' => '12.00',
                'margin_right_mm' => '12.00',
                'margin_bottom_mm' => '12.00',
                'margin_left_mm' => '12.00',
                'orientation' => 'portrait',
                // A4 is an administrative alternative to the principal design and
                // shares the new compact template; it keeps the single-copy default.
                'template_code' => 'institutional_compact',
                'font_family' => 'Arial, sans-serif',
                'font_scale' => '1.00',
                'copies_mode' => 'original_only',
                'show_copy_legend' => true,
                'show_physical_seal_space' => true,
                'use_logo' => false,
                'show_technical_fields' => false,
                'active' => true,
                'is_global_default' => false,
            ],
            ReceiptPrintProfile::CODE_THERMAL_80 => [
                'code' => ReceiptPrintProfile::CODE_THERMAL_80,
                'name' => 'Termica 80 mm',
                'paper_kind' => 'thermal_80mm',
                'width_mm' => '80.00',
                'height_mm' => '200.00',
                'margin_top_mm' => '1.00',
                'margin_right_mm' => '1.00',
                'margin_bottom_mm' => '1.00',
                'margin_left_mm' => '1.00',
                'orientation' => 'portrait',
                'template_code' => 'institutional_thermal',
                'font_family' => 'DejaVu Sans Mono, monospace',
                'font_scale' => '1.00',
                'copies_mode' => 'original_only',
                'show_copy_legend' => false,
                'show_physical_seal_space' => false,
                'use_logo' => false,
                'show_technical_fields' => false,
                'active' => true,
                'is_global_default' => false,
            ],
            ReceiptPrintProfile::CODE_THERMAL_58 => [
                'code' => ReceiptPrintProfile::CODE_THERMAL_58,
                'name' => 'Termica 58 mm',
                'paper_kind' => 'thermal_58mm',
                'width_mm' => '58.00',
                'height_mm' => '200.00',
                'margin_top_mm' => '1.00',
                'margin_right_mm' => '1.00',
                'margin_bottom_mm' => '1.00',
                'margin_left_mm' => '1.00',
                'orientation' => 'portrait',
                'template_code' => 'institutional_thermal',
                'font_family' => 'DejaVu Sans Mono, monospace',
                'font_scale' => '1.00',
                'copies_mode' => 'original_only',
                'show_copy_legend' => false,
                'show_physical_seal_space' => false,
                'use_logo' => false,
                'show_technical_fields' => false,
                'active' => true,
                'is_global_default' => false,
            ],
        ];

        // Detect a brand-new catalog BEFORE inserting. Only then may the seeder
        // decide the global default; an already configured installation keeps the
        // paper output it had and is never repointed in silence.
        $hasExistingCatalog = ReceiptPrintProfile::query()->exists();

        foreach ($profiles as $code => $defaults) {
            unset($defaults['code']);

            // Never overwrite a pre-existing profile: existing installations keep
            // their active delivery configuration and historical snapshots.
            ReceiptPrintProfile::query()->firstOrCreate(['code' => $code], $defaults);
        }

        if (! $hasExistingCatalog) {
            $this->promoteProposedGlobalDefault();
        }

        // R2-RCP-01: an installation that was already seeded/configured kept its
        // legacy landscape default, so NEW receipts kept rendering 612 x 396 pt
        // even though carta vertical was the declared principal design. Promote
        // the proposed portrait design for those installations too. The action is
        // guarded (only a legacy landscape default is repointed), idempotent and
        // audited; issued receipts keep their own `profile_snapshot`.
        app(PromoteProposedReceiptPrintProfileAction::class)->execute();

        // T-RC-01: an installation that already owns the portrait rows from the
        // previous delivery keeps `institutional_classic` on them, so NEW receipts
        // would keep the old composition. Adopt the new compact template on the
        // proposed portrait profiles only, audited and without touching copies,
        // paper or already issued receipts (see the action's contract).
        app(AdoptCompactReceiptTemplateAction::class)->execute();
    }

    /**
     * Leave a brand-new installation with exactly ONE global default: the proposed
     * principal design (`carta_vertical`), falling back to the historical
     * `media_carta_horizontal` only if the portrait row is missing.
     *
     * Runs only when this seeder created the catalog from scratch. The singleton
     * guard `uniq_receipt_print_profiles_global_default` (migration
     * 2026_06_15_000004) allows a single `is_global_default = 1` row, so this
     * method re-checks the invariant and never sets a second flag.
     */
    private function promoteProposedGlobalDefault(): void
    {
        if (ReceiptPrintProfile::query()->where('is_global_default', true)->exists()) {
            return;
        }

        foreach ([ReceiptPrintProfile::CODE_LETTER_PORTRAIT, ReceiptPrintProfile::CODE_HALF_LETTER] as $code) {
            $profile = ReceiptPrintProfile::query()
                ->where('code', $code)
                ->where('active', true)
                ->first();

            if ($profile instanceof ReceiptPrintProfile) {
                $profile->update(['is_global_default' => true]);

                return;
            }
        }
    }
}
