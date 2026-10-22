<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * T-RC-02 — make the NEW institutional delivery profile effective on an
 * EXISTING installation.
 *
 * Problem being repaired
 * ----------------------
 * `ReceiptPrintProfileSeeder` is insert-only by contract (`firstOrCreate`), so a
 * lab/hospital that was seeded by the previous delivery already owns the
 * `carta_vertical` row with the historical values:
 *
 *     template_code = 'institutional_classic'
 *     copies_mode   = 'original_first_second'   (three concatenated documents)
 *
 * Re-running the seeder never updates that row, so a brand-new receipt keeps
 * rendering the classic composition with three copies even though the declared
 * principal design is `institutional_compact` with ONE patient copy. The real
 * downloaded receipt (lab id 8) proved it:
 * `template_code:"institutional_classic"`, `profile_snapshot.copies_mode:
 * "original_first_second"`.
 *
 * What this migration does
 * ------------------------
 * For the two proposed portrait delivery profiles only
 * (`carta_vertical`, `a4_vertical`), it adopts the NEW delivery on a row that is
 * still RECOGNIZABLY the untouched legacy proposal:
 *
 *   - portrait orientation;
 *   - exact seeded geometry (215.90 x 279.40 mm / 210.00 x 297.00 mm);
 *   - 12 mm margins on all four sides;
 *   - `copies_mode = original_first_second` (the old three-copy proposal);
 *   - `template_code` in ('institutional_classic', 'institutional_compact').
 *
 * When (and only when) all of that holds, the row changes to:
 *
 *     template_code = 'institutional_compact'
 *     copies_mode   = 'original_only'
 *
 * Everything else (geometry, margins, fonts, logo flags, active/default flags)
 * is left untouched.
 *
 * What it deliberately does NOT do
 * --------------------------------
 * - It never overwrites a customized profile: a different template, a
 *   non-legacy copy mode, different margins or different geometry means the
 *   admin configured that row, and it is skipped entirely.
 * - It never touches `receipt_profile_assignments`; an explicit assignment to
 *   another profile stays exactly as the operator left it.
 * - It never changes `is_global_default`; the guarded
 *   `PromoteProposedReceiptPrintProfileAction` remains the only path that
 *   repoints a legacy landscape default.
 * - It never creates profiles. On a brand-new installation the seeder inserts
 *   the portrait rows already carrying the new delivery, so this migration is a
 *   no-op there (and it must not pre-create the catalog, or the seeder would
 *   stop promoting the global default).
 * - It never rewrites issued receipts: they keep their own `template_code` and
 *   `profile_snapshot`, so historical documents keep the classic composition.
 *
 * Every adopted row is written to `audit_logs` with before/after values and a
 * reason. The migration is idempotent: after the first run no row matches the
 * legacy guard anymore. `down()` intentionally does not revert the adoption: an
 * administrator may have edited the row after the upgrade, and silently
 * restoring three copies on rollback would be exactly the kind of hidden
 * delivery change this task forbids.
 */
return new class extends Migration
{
    private const TABLE = 'receipt_print_profiles';

    public const ACTION = 'receipt_print_profile.delivery_adopted';

    public const REASON = 'T-RC-02: adopta la entrega nueva (plantilla compacta institucional + un ejemplar) en los perfiles verticales que siguen siendo la propuesta heredada sin personalizar; no toca asignaciones, documentos emitidos ni perfiles personalizados.';

    private const ENTITY_TYPE = 'App\\Models\\ReceiptPrintProfile';

    /**
     * Proposed portrait delivery profiles. `paper_kinds` accepts the native kind
     * plus the equivalent custom_mm geometry, so the guard also recognizes a row
     * that the enum repoint migration could not convert.
     *
     * @var list<array{code: string, width_mm: float, height_mm: float, paper_kinds: list<string>}>
     */
    private const TARGETS = [
        [
            'code' => 'carta_vertical',
            'width_mm' => 215.90,
            'height_mm' => 279.40,
            'paper_kinds' => ['letter_portrait', 'custom_mm'],
        ],
        [
            'code' => 'a4_vertical',
            'width_mm' => 210.00,
            'height_mm' => 297.00,
            'paper_kinds' => ['a4_portrait', 'custom_mm'],
        ],
    ];

    private const LEGACY_COPIES = 'original_first_second';

    private const NEW_COPIES = 'original_only';

    private const LEGACY_TEMPLATES = ['institutional_classic', 'institutional_compact'];

    private const NEW_TEMPLATE = 'institutional_compact';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)
            || ! Schema::hasColumn(self::TABLE, 'template_code')
            || ! Schema::hasColumn(self::TABLE, 'copies_mode')) {
            return;
        }

        foreach (self::TARGETS as $target) {
            $this->adoptTarget($target);
        }
    }

    public function down(): void
    {
        // Deliberately irreversible: reverting would silently remove copies an
        // admin may have configured after the upgrade. See the class docblock.
    }

    /**
     * @param  array{code: string, width_mm: float, height_mm: float, paper_kinds: list<string>}  $target
     */
    private function adoptTarget(array $target): void
    {
        $row = DB::table(self::TABLE)->where('code', $target['code'])->first();

        if ($row === null || ! $this->isUntouchedLegacyDelivery($row, $target)) {
            return;
        }

        $previousTemplate = (string) $row->template_code;
        $previousCopies = (string) $row->copies_mode;

        $newValues = [];

        if ($previousTemplate !== self::NEW_TEMPLATE) {
            $newValues['template_code'] = self::NEW_TEMPLATE;
        }

        if ($previousCopies !== self::NEW_COPIES) {
            $newValues['copies_mode'] = self::NEW_COPIES;
        }

        if ($newValues === []) {
            return;
        }

        DB::table(self::TABLE)
            ->where('id', $row->id)
            ->update($newValues);

        DB::table('audit_logs')->insert([
            'user_id' => null,
            'action' => self::ACTION,
            'entity_type' => self::ENTITY_TYPE,
            'entity_id' => $row->id,
            'old_values' => json_encode([
                'code' => (string) $row->code,
                'template_code' => $previousTemplate,
                'copies_mode' => $previousCopies,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'new_values' => json_encode([
                'code' => (string) $row->code,
                'template_code' => self::NEW_TEMPLATE,
                'copies_mode' => self::NEW_COPIES,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'reason' => self::REASON,
            'created_at' => now(),
        ]);
    }

    /**
     * Recognizes ONLY the untouched legacy seeded delivery. Any deviation is an
     * explicit admin customization and must be preserved.
     *
     * @param  array{code: string, width_mm: float, height_mm: float, paper_kinds: list<string>}  $target
     */
    private function isUntouchedLegacyDelivery(object $row, array $target): bool
    {
        if ((string) $row->orientation !== 'portrait') {
            return false;
        }

        if (! in_array((string) $row->paper_kind, $target['paper_kinds'], true)) {
            return false;
        }

        if (! in_array((string) $row->template_code, self::LEGACY_TEMPLATES, true)) {
            return false;
        }

        if ((string) $row->copies_mode !== self::LEGACY_COPIES) {
            return false;
        }

        foreach (['width_mm' => $target['width_mm'], 'height_mm' => $target['height_mm']] as $column => $expected) {
            if (! $this->matches($row->{$column} ?? null, $expected)) {
                return false;
            }
        }

        foreach (['margin_top_mm', 'margin_right_mm', 'margin_bottom_mm', 'margin_left_mm'] as $column) {
            if (! $this->matches($row->{$column} ?? null, 12.0)) {
                return false;
            }
        }

        return true;
    }

    private function matches(mixed $value, float $expected): bool
    {
        return is_numeric($value) && abs((float) $value - $expected) < 0.01;
    }
};
