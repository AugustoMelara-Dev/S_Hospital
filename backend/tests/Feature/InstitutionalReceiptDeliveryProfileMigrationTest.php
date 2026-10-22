<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Actions\InstitutionalReceipts\ResolveReceiptPrintProfileAction;
use App\Models\CashRegisterSession;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Models\ReceiptProfileAssignment;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * T-RC-02 — the migration that makes the NEW delivery profile effective on an
 * EXISTING installation (`2026_09_18_000003_adopt_new_receipt_delivery_profile`).
 *
 * The real lab receipt (id 8) proved the defect: an installation seeded before
 * T-RC-01 kept `template_code = institutional_classic` and
 * `copies_mode = original_first_second` on `carta_vertical`, so a brand-new
 * emission still produced three classic documents. The seeder is insert-only,
 * so `firstOrCreate` never repaired it.
 *
 * The tests simulate the legacy row AFTER the migration ran on the empty test
 * database, then invoke the migration's `up()` explicitly (same pattern as
 * `Tests\Feature\Migrations\LegacyReprintCountMigrationTest`).
 */
class InstitutionalReceiptDeliveryProfileMigrationTest extends TestCase
{
    use RefreshDatabase;

    private const MIGRATION = 'database/migrations/2026_09_18_000003_adopt_new_receipt_delivery_profile.php';

    public function test_migration_adopts_the_untouched_legacy_delivery_and_audits_the_change(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $letter = $this->legacyPortraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $a4 = $this->legacyPortraitProfile(ReceiptPrintProfile::CODE_A4_PORTRAIT);

        $migration = $this->migration();
        $migration->up();

        $this->assertSame('institutional_compact', $letter->refresh()->template_code);
        $this->assertSame('original_only', $letter->copies_mode);
        // Geometry, margins and identity are untouched: only the delivery changed.
        $this->assertSame('letter_portrait', $letter->paper_kind);
        $this->assertSame('215.90', (string) $letter->width_mm);
        $this->assertSame('279.40', (string) $letter->height_mm);
        $this->assertSame('12.00', (string) $letter->margin_top_mm);

        $this->assertSame('institutional_compact', $a4->refresh()->template_code);
        $this->assertSame('original_only', $a4->copies_mode);

        foreach ([$letter, $a4] as $profile) {
            $this->assertDatabaseHas('audit_logs', [
                'action' => 'receipt_print_profile.delivery_adopted',
                'entity_type' => 'App\\Models\\ReceiptPrintProfile',
                'entity_id' => $profile->id,
            ]);
        }

        $letterAudit = DB::table('audit_logs')
            ->where('action', 'receipt_print_profile.delivery_adopted')
            ->where('entity_id', $letter->id)
            ->first();
        $this->assertNotNull($letterAudit);
        $this->assertSame('institutional_classic', json_decode((string) $letterAudit->old_values, true)['template_code']);
        $this->assertSame('original_first_second', json_decode((string) $letterAudit->old_values, true)['copies_mode']);
        $this->assertSame('institutional_compact', json_decode((string) $letterAudit->new_values, true)['template_code']);
        $this->assertSame('original_only', json_decode((string) $letterAudit->new_values, true)['copies_mode']);
    }

    public function test_migration_is_idempotent_and_does_not_duplicate_the_audit_trail(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $this->legacyPortraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $this->legacyPortraitProfile(ReceiptPrintProfile::CODE_A4_PORTRAIT);

        $migration = $this->migration();
        $migration->up();

        $adopted = DB::table('receipt_print_profiles')
            ->whereIn('code', [ReceiptPrintProfile::CODE_LETTER_PORTRAIT, ReceiptPrintProfile::CODE_A4_PORTRAIT])
            ->orderBy('code')
            ->get()
            ->map(fn (object $row): array => [(string) $row->template_code, (string) $row->copies_mode])
            ->all();

        $auditCount = DB::table('audit_logs')
            ->where('action', 'receipt_print_profile.delivery_adopted')
            ->count();

        $migration->up();

        $this->assertSame($adopted, DB::table('receipt_print_profiles')
            ->whereIn('code', [ReceiptPrintProfile::CODE_LETTER_PORTRAIT, ReceiptPrintProfile::CODE_A4_PORTRAIT])
            ->orderBy('code')
            ->get()
            ->map(fn (object $row): array => [(string) $row->template_code, (string) $row->copies_mode])
            ->all());
        $this->assertSame($auditCount, DB::table('audit_logs')
            ->where('action', 'receipt_print_profile.delivery_adopted')
            ->count());
    }

    public function test_migration_preserves_customized_profiles(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        // A customized margin: the admin configured this row.
        $letter = $this->legacyPortraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $letter->forceFill(['margin_top_mm' => '15.00'])->save();

        // A customized copy count: the admin asked for two copies.
        $a4 = $this->legacyPortraitProfile(ReceiptPrintProfile::CODE_A4_PORTRAIT);
        $a4->forceFill(['copies_mode' => 'original_first'])->save();

        $before = ReceiptPrintProfile::query()
            ->whereIn('code', [ReceiptPrintProfile::CODE_LETTER_PORTRAIT, ReceiptPrintProfile::CODE_A4_PORTRAIT])
            ->orderBy('code')
            ->get()
            ->toArray();

        $this->migration()->up();

        $this->assertSame(
            $before,
            ReceiptPrintProfile::query()
                ->whereIn('code', [ReceiptPrintProfile::CODE_LETTER_PORTRAIT, ReceiptPrintProfile::CODE_A4_PORTRAIT])
                ->orderBy('code')
                ->get()
                ->toArray(),
            'A profile the admin customized must not be overwritten.',
        );
        $this->assertSame(0, DB::table('audit_logs')
            ->where('action', 'receipt_print_profile.delivery_adopted')
            ->count());
    }

    public function test_migration_preserves_a_custom_template_even_when_the_rest_is_legacy(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $letter = $this->legacyPortraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $letter->forceFill(['template_code' => 'institutional_custom_by_admin'])->save();

        $this->migration()->up();

        $this->assertSame('institutional_custom_by_admin', $letter->refresh()->template_code);
        $this->assertSame('original_first_second', $letter->copies_mode);
    }

    public function test_migration_never_touches_explicit_assignments_or_the_global_default(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $letter = $this->legacyPortraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);
        $halfLetter = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();

        // The installation explicitly uses media carta; its global default and
        // its active assignment must survive the migration untouched.
        $letter->forceFill(['is_global_default' => false])->save();
        $halfLetter->forceFill(['is_global_default' => true])->save();

        $user = User::factory()->create();
        $assignment = ReceiptProfileAssignment::query()->create([
            'receipt_print_profile_id' => $halfLetter->id,
            'scope_type' => ReceiptProfileAssignment::SCOPE_GLOBAL,
            'scope_id' => null,
            'active' => true,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $this->migration()->up();

        $this->assertSame('institutional_compact', $letter->refresh()->template_code);
        $this->assertSame('original_only', $letter->copies_mode);
        $this->assertTrue((bool) $halfLetter->refresh()->is_global_default);
        $this->assertSame($halfLetter->id, (int) $assignment->refresh()->receipt_print_profile_id);

        // Resolution follows the explicit assignment, not the adopted row.
        $resolved = app(ResolveReceiptPrintProfileAction::class)->execute();
        $this->assertSame(ReceiptPrintProfile::CODE_HALF_LETTER, $resolved->code);
    }

    public function test_a_new_emission_uses_the_adopted_delivery_after_the_migration(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $this->legacyPortraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);

        $this->migration()->up();

        $profile = app(ResolveReceiptPrintProfileAction::class)->execute();
        $this->assertSame(ReceiptPrintProfile::CODE_LETTER_PORTRAIT, $profile->code);
        $this->assertSame('institutional_compact', $profile->template_code);
        $this->assertSame('original_only', $profile->copies_mode);

        $pdfService = app(InstitutionalReceiptPdfService::class);
        $this->assertSame(['ORIGINAL'], $pdfService->copyLabelsForProfile($profile));

        $draft = $pdfService->htmlForDraft([
            'payer_name' => 'Paciente Sintetico T-RC-02',
            'concept' => 'Servicios de prueba',
            'amount' => '25.00',
        ], $profile);

        $this->assertStringContainsString('data-receipt-style="compact-monochrome"', $draft);
        $this->assertStringNotContainsString('SEGUNDA COPIA', $draft);
        $this->assertStringNotContainsString('PRIMERA COPIA', $draft);
    }

    public function test_issued_receipts_keep_their_own_snapshot_across_the_migration(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $letter = $this->legacyPortraitProfile(ReceiptPrintProfile::CODE_LETTER_PORTRAIT);

        $user = User::factory()->create();
        $cashSession = CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);
        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-MIG',
            'prefix' => 'RM',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 1,
            'active' => false,
        ]);

        $issued = InstitutionalReceipt::query()->create([
            'invoice_id' => null,
            'payment_id' => null,
            'cash_session_id' => $cashSession->id,
            'series_id' => $series->id,
            'receipt_number' => 8,
            'receipt_number_full' => 'REC-MIG-00000008',
            'status' => InstitutionalReceipt::STATUS_ISSUED,
            'amount' => '517.50',
            'amount_cents' => 51750,
            'issued_at' => now(),
            'issued_by' => $user->id,
            'payer_name' => 'Maria Lopez',
            'concept' => 'Eritropoyetina, Abdomen Embarazo',
            'amount_words' => 'QUINIENTOS DIECISIETE LEMPIRAS CON 50/100 CENTAVOS',
            // Exactly the snapshot the real lab receipt id 8 carries today.
            'template_code' => 'institutional_classic',
            'print_profile_code' => 'carta_vertical',
            'copy_mode' => 'original_first_second',
            'institution_snapshot' => ['hospital_name' => 'Hospital General San Isidro'],
            'series_snapshot' => ['series' => 'REC-MIG'],
            'profile_snapshot' => [
                'code' => 'carta_vertical',
                'paper_kind' => 'letter_portrait',
                'template_code' => 'institutional_classic',
                'copies_mode' => 'original_first_second',
                'margin_top_mm' => '12.00',
            ],
            'invoice_snapshot' => ['invoice_number' => '000-001-01-00000016'],
            'payment_snapshot' => ['selected_payment' => ['method' => 'cash']],
            'items_snapshot' => [['service_name' => 'Eritropoyetina', 'line_total_cents' => 0]],
        ]);

        $before = DB::table('institutional_receipts')->where('id', $issued->id)->first();

        $this->migration()->up();

        $after = DB::table('institutional_receipts')->where('id', $issued->id)->first();
        $this->assertEquals($before, $after, 'An issued receipt keeps its historical snapshot.');
        $this->assertSame('institutional_classic', $after->template_code);
        $this->assertSame('original_first_second', $after->copy_mode);
        $this->assertSame('institutional_classic', json_decode((string) $after->profile_snapshot, true)['template_code']);
        $this->assertSame('institutional_compact', $letter->refresh()->template_code);
    }

    private function legacyPortraitProfile(string $code): ReceiptPrintProfile
    {
        $profile = ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();

        // Reproduce the row seeded before T-RC-01 on an existing installation.
        $profile->forceFill([
            'template_code' => 'institutional_classic',
            'copies_mode' => 'original_first_second',
            'margin_top_mm' => '12.00',
            'margin_right_mm' => '12.00',
            'margin_bottom_mm' => '12.00',
            'margin_left_mm' => '12.00',
        ])->save();

        return $profile;
    }

    private function migration(): object
    {
        return include base_path(self::MIGRATION);
    }
}
