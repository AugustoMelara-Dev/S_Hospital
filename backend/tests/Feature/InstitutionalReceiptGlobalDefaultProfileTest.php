<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptHtmlBuilder;
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
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * C1-RCP-02 — perfil global por defecto y fuente única del conteo de copias.
 *
 * Decisión (mandato §12, actualizada por R2-RCP-01): en una instalación NUEVA el
 * único perfil global por defecto es `carta_vertical` (215.90 x 279.40 mm =
 * 612 x 792 pt). En una instalación EXISTENTE cuyo predeterminado declarado es un
 * perfil apaisado legacy, el promotor auditado
 * (`PromoteProposedReceiptPrintProfileAction`) lo reapunta a `carta_vertical`
 * para que los recibos NUEVOS dejen de salir 612 x 396 pt. Una elección
 * explícita NO apaisada del administrador (p. ej. `a4_vertical`) se respeta y no
 * se reapunta. Los recibos ya emitidos conservan su `profile_snapshot` y su
 * MediaBox histórico.
 *
 * Contrato del conteo de copias: `InstitutionalReceiptHtmlBuilder::copyLabels()`
 * / `copyCount()` es la fuente única. El PDF, la vista previa del motor y la
 * respuesta `copy_count` / `copy_labels` de `/test-preview` salen de ahí.
 */
class InstitutionalReceiptGlobalDefaultProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_installation_promotes_carta_vertical_as_the_only_global_default(): void
    {
        // Catálogo nuevo: no hay filas antes de sembrar.
        $this->assertSame(0, ReceiptPrintProfile::query()->count());

        $this->seed(ReceiptPrintProfileSeeder::class);

        $defaults = ReceiptPrintProfile::query()->where('is_global_default', true)->get();
        $this->assertCount(1, $defaults, 'A new installation must have exactly one global default.');
        $this->assertSame(ReceiptPrintProfile::CODE_LETTER_PORTRAIT, $defaults->sole()->code);

        // El diseño histórico sigue disponible y activo; solo deja de ser el predeterminado.
        $halfLetter = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();
        $this->assertTrue((bool) $halfLetter->active);
        $this->assertFalse((bool) $halfLetter->is_global_default);
        $this->assertSame('original_first_second', $halfLetter->copies_mode);

        // El resto del catálogo queda intacto: 8 perfiles y ningún otro predeterminado.
        $this->assertSame(8, ReceiptPrintProfile::query()->count());
        $this->assertSame(
            0,
            ReceiptPrintProfile::query()
                ->where('is_global_default', true)
                ->where('code', '!=', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
                ->count(),
        );

        // El resolvedor de producción entrega carta vertical en instalación nueva.
        $resolved = app(ResolveReceiptPrintProfileAction::class)->execute();
        $this->assertSame(ReceiptPrintProfile::CODE_LETTER_PORTRAIT, $resolved->code);
    }

    /**
     * R2-RCP-01 (replaces the former C1-RCP-02 expectation).
     *
     * C1-RCP-02 asserted that an existing installation kept its global default
     * and was never repointed. That expectation was replaced by R2-RCP-01 for a
     * precise reason: an already configured installation kept
     * `media_carta_horizontal` as its declared default, so every NEW receipt kept
     * rendering landscape 612 x 396 pt even though the principal design was
     * `carta_vertical`. The user's downloaded PDF proved it and the coordinator
     * measured the after-state at 612 x 792 pt (R2-RCP-01/RESULTADO_MEDIDO.md).
     *
     * The new contract this test protects:
     * - re-seeding an existing installation whose declared default is a legacy
     *   landscape profile DOES repoint it to `carta_vertical`;
     * - the resolved profile (the value the PDF generator reads) is portrait, so
     *   removing the promotion step makes this test fail with the old landscape
     *   output (regression guard);
     * - only the singleton flag changes: geometry and `copies_mode` stay as
     *   configured, and the repoint is written to the audit trail.
     */
    public function test_reseeding_an_existing_landscape_installation_promotes_the_proposed_portrait_default(): void
    {
        $this->seed(ReceiptPrintProfileSeeder::class);

        // Simulates the installation prior to R2-RCP-01: media carta was the
        // declared global default and carta vertical a merely available profile.
        ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail()
            ->forceFill(['is_global_default' => false])->save();
        ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail()
            ->forceFill(['is_global_default' => true])->save();

        $halfLetterBefore = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail()
            ->only(['paper_kind', 'width_mm', 'height_mm', 'orientation', 'copies_mode', 'active']);
        $portraitBefore = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail()
            ->only(['paper_kind', 'width_mm', 'height_mm', 'orientation', 'copies_mode', 'active']);

        DB::table('audit_logs')->where('action', 'receipt_print_profile.promoted_default')->delete();

        $this->seed(ReceiptPrintProfileSeeder::class);

        $defaults = ReceiptPrintProfile::query()->where('is_global_default', true)->get();
        $this->assertCount(1, $defaults, 'The singleton guard still allows exactly one default.');
        $this->assertSame(
            ReceiptPrintProfile::CODE_LETTER_PORTRAIT,
            $defaults->sole()->code,
            'R2-RCP-01: a legacy landscape default must be repointed to carta vertical on re-seed; '
            .'a media_carta_horizontal default here is the old 612 x 396 pt regression.',
        );

        // The value the real PDF generator resolves must be portrait. If the
        // promotion step is removed or disabled, this fails with the old
        // landscape output.
        $this->assertSame(
            ReceiptPrintProfile::CODE_LETTER_PORTRAIT,
            app(ResolveReceiptPrintProfileAction::class)->execute()->code,
        );

        // Only the default flag moved: geometry, orientation and copies stay as
        // configured, so promotion never silently rewrites a profile's layout.
        $this->assertSame(
            $halfLetterBefore,
            ReceiptPrintProfile::query()
                ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
                ->firstOrFail()
                ->only(['paper_kind', 'width_mm', 'height_mm', 'orientation', 'copies_mode', 'active']),
            'Repointing the default must not alter the historical landscape profile geometry or copies.',
        );
        $this->assertSame(
            $portraitBefore,
            ReceiptPrintProfile::query()
                ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
                ->firstOrFail()
                ->only(['paper_kind', 'width_mm', 'height_mm', 'orientation', 'copies_mode', 'active']),
            'Promotion must not alter the portrait profile geometry or copies.',
        );

        // The paper change is traceable: it is audited, not silent.
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'receipt_print_profile.promoted_default',
            'entity_type' => ReceiptPrintProfile::class,
        ]);
    }

    /**
     * The other half of the R2-RCP-01 guard: an explicit NON-landscape choice is
     * an admin decision and must never be repointed by a re-seed. This protects
     * the "respect an explicit configuration" rule that C1-RCP-02 cared about,
     * now scoped to profiles the proposed delivery does not replace.
     */
    public function test_existing_installation_with_an_explicit_portrait_default_is_not_repointed(): void
    {
        $this->seed(ReceiptPrintProfileSeeder::class);

        // Admin explicitly chose the configurable A4 portrait design.
        ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail()
            ->forceFill(['is_global_default' => false])->save();
        ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_A4_PORTRAIT)
            ->firstOrFail()
            ->forceFill(['is_global_default' => true])->save();

        $this->seed(ReceiptPrintProfileSeeder::class);

        $defaults = ReceiptPrintProfile::query()->where('is_global_default', true)->get();
        $this->assertCount(1, $defaults);
        $this->assertSame(
            ReceiptPrintProfile::CODE_A4_PORTRAIT,
            $defaults->sole()->code,
            'An explicit non-landscape admin default must be respected by the promotor.',
        );
        $this->assertSame(
            ReceiptPrintProfile::CODE_A4_PORTRAIT,
            app(ResolveReceiptPrintProfileAction::class)->execute()->code,
        );
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'receipt_print_profile.promoted_default',
        ]);
    }

    public function test_reseeding_a_new_installation_is_idempotent(): void
    {
        $this->seed(ReceiptPrintProfileSeeder::class);
        $first = $this->catalogSnapshot();

        $this->seed(ReceiptPrintProfileSeeder::class);
        $second = $this->catalogSnapshot();

        $this->assertSame($first, $second, 'Seeding twice must be a no-op.');
        $defaults = ReceiptPrintProfile::query()->where('is_global_default', true)->get();
        $this->assertCount(1, $defaults);
        $this->assertSame(ReceiptPrintProfile::CODE_LETTER_PORTRAIT, $defaults->sole()->code);
    }

    /**
     * Frontera explícita: el seeder solo decide el predeterminado en un catálogo
     * NUEVO. Si una instalación existente quedó sin predeterminado (el admin lo
     * retiró vía API), el seeder no inventa uno en silencio. El guard de
     * singleton limita a MÁXIMO uno, no obliga a que siempre haya uno.
     */
    public function test_existing_installation_with_no_default_is_not_silently_promoted(): void
    {
        $this->seed(ReceiptPrintProfileSeeder::class);

        ReceiptPrintProfile::query()
            ->where('is_global_default', true)
            ->each(fn (ReceiptPrintProfile $profile) => $profile->forceFill(['is_global_default' => false])->save());

        $this->seed(ReceiptPrintProfileSeeder::class);

        $this->assertSame(
            0,
            ReceiptPrintProfile::query()->where('is_global_default', true)->count(),
            'An existing installation owns its configuration: the seeder must not invent a default.',
        );
    }

    public function test_singleton_guard_rejects_a_second_global_default_on_mariadb(): void
    {
        $driver = DB::connection()->getDriverName();

        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('The generated-column unique guard only exists on MySQL/MariaDB.');
        }

        $this->assertTrue(Schema::hasColumn('receipt_print_profiles', 'global_default_unique_key'));
        $this->seed(ReceiptPrintProfileSeeder::class);

        $this->assertSame(1, ReceiptPrintProfile::query()->where('is_global_default', true)->count());

        $this->expectException(QueryException::class);

        // Segundo predeterminado: el índice único generado lo rechaza.
        DB::table('receipt_print_profiles')
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->update(['is_global_default' => 1]);
    }

    public function test_engine_copy_count_is_the_single_source_for_carta_vertical_and_a4(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-C1R',
            'prefix' => 'RC',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 4,
            'range_authorization' => 'AUT-C1-RCP-02',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'active' => true,
        ]);

        $builder = app(InstitutionalReceiptHtmlBuilder::class);
        $pdfService = app(InstitutionalReceiptPdfService::class);

        // T-RC-01 (mandato §11): the new delivery defaults to ONE patient copy for
        // both portrait profiles. Additional copies are an explicit selection, so
        // the engine (not a parallel form counter) derives multi-copy sets too.
        $expected = [
            ReceiptPrintProfile::CODE_LETTER_PORTRAIT => [
                'count' => 1,
                'labels' => ['ORIGINAL'],
            ],
            ReceiptPrintProfile::CODE_A4_PORTRAIT => [
                'count' => 1,
                'labels' => ['ORIGINAL'],
            ],
        ];

        // The single source still derives explicit multi-copy selections.
        $this->assertSame(
            ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'],
            $builder->copyLabels('original_first_second'),
        );
        $this->assertSame(3, $builder->copyCount('original_first_second'));
        $this->assertSame(2, $builder->copyCount('original_first'));
        $this->assertSame(1, $builder->copyCount('original_only'));

        foreach ($expected as $code => $expectation) {
            $profile = ReceiptPrintProfile::query()->where('code', $code)->firstOrFail();

            // La misma fuente que usa el motor: labels y conteo derivados del modo.
            $engineLabels = $builder->copyLabels($profile->copies_mode);
            $engineCount = $builder->copyCount($profile->copies_mode);

            $this->assertSame($expectation['labels'], $engineLabels, "{$code}: engine labels");
            $this->assertSame($expectation['count'], $engineCount, "{$code}: engine count");

            $response = $this->actingAs($admin)
                ->postJson('/api/settings/institutional-receipts/test-preview', [
                    'profile_code' => $code,
                    'payer_name' => 'Paciente de prueba',
                    'concept' => 'Servicios hospitalarios de prueba',
                    'amount' => '25.00',
                ])
                ->assertOk()
                ->assertJsonPath('data.reserved_number', false);

            // El número que consume la UI (copy_count/copy_labels) es exactamente
            // el del motor, no un cálculo paralelo del formulario.
            $this->assertSame($engineCount, $response->json('data.copy_count'), "{$code}: API copy_count");
            $this->assertSame($engineLabels, $response->json('data.copy_labels'), "{$code}: API copy_labels");

            // Y el PDF real del motor genera una página por copia.
            $pdf = $pdfService->pdfForDraft([
                'payer_name' => 'Paciente de prueba',
                'concept' => 'Consulta de prueba',
                'amount' => '25.00',
            ], $profile);

            $this->assertStringStartsWith('%PDF', $pdf);
            $this->assertSame(
                $engineCount,
                preg_match_all('/\/Type\s*\/Page\b/', $pdf),
                "{$code}: the PDF must render exactly one page per engine copy",
            );
        }
    }

    public function test_promoting_the_default_does_not_change_already_issued_receipts(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $halfLetter = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();
        $portrait = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();

        // Simula la instalación histórica previa a C1-RCP-02: media carta era el
        // único predeterminado global. El recibo se emite en ese estado.
        $portrait->forceFill(['is_global_default' => false])->save();
        $halfLetter->forceFill(['is_global_default' => true])->save();

        $receipt = $this->historicalMediaCartaReceiptFixture($halfLetter);
        $receiptRowBefore = $receipt->fresh()->toArray();
        $this->assertSame(
            ReceiptPrintProfile::CODE_HALF_LETTER,
            ReceiptPrintProfile::query()->where('is_global_default', true)->sole()->code,
        );

        // R2-RCP-01: the seeder itself now promotes the proposed portrait default
        // for an installation whose declared default is a legacy landscape profile.
        // This exercises the real upgrade path (not a hand-made flag flip) so the
        // test proves the seeder-driven promotion never rewrites issued receipts.
        $this->seed(ReceiptPrintProfileSeeder::class);

        $this->assertSame(
            ReceiptPrintProfile::CODE_LETTER_PORTRAIT,
            ReceiptPrintProfile::query()->where('is_global_default', true)->sole()->code,
        );

        // El recibo histórico no se toca ni cambia de perfil.
        $fresh = $receipt->fresh();
        $this->assertSame($receiptRowBefore, $fresh->toArray(), 'Promoting the default must not rewrite issued receipts.');
        $this->assertSame(ReceiptPrintProfile::CODE_HALF_LETTER, $fresh->print_profile_code);
        $this->assertSame('original_first_second', $fresh->copy_mode);
        $this->assertSame($receipt->profile_snapshot, $fresh->profile_snapshot);

        $service = app(InstitutionalReceiptPdfService::class);
        $html = $service->htmlForReceipt($fresh);

        // Sigue renderizando con SU snapshot: media carta horizontal y 3 copias.
        $this->assertStringContainsString('profile-media_carta_horizontal', $html);
        $this->assertSame(3, substr_count($html, 'data-receipt-copy-label='));
        $this->assertStringContainsString('data-receipt-copy-label="ORIGINAL"', $html);
        $this->assertStringContainsString('data-receipt-copy-label="PRIMERA COPIA"', $html);
        $this->assertStringContainsString('data-receipt-copy-label="SEGUNDA COPIA"', $html);
        $this->assertStringNotContainsString('Copia 1 de 3', $html);

        $pdf = $service->pdfForReceipt($fresh);
        $box = $this->firstMediaBox($pdf);
        $this->assertEqualsWithDelta(612.0, $box[2], 0.05, 'Historical media carta width must not change');
        $this->assertEqualsWithDelta(396.0, $box[3], 0.05, 'Historical media carta height must not change');

        // Un recibo nuevo (sin asignación explícita) sí resuelve el nuevo predeterminado.
        $this->assertSame(
            ReceiptPrintProfile::CODE_LETTER_PORTRAIT,
            app(ResolveReceiptPrintProfileAction::class)->execute()->code,
        );

        // Una asignación explícita a media carta sigue ganando al predeterminado.
        ReceiptProfileAssignment::query()->create([
            'receipt_print_profile_id' => $halfLetter->id,
            'scope_type' => ReceiptProfileAssignment::SCOPE_GLOBAL,
            'scope_id' => null,
            'active' => true,
            'created_by' => $receipt->issued_by,
            'updated_by' => $receipt->issued_by,
        ]);

        $this->assertSame(
            ReceiptPrintProfile::CODE_HALF_LETTER,
            app(ResolveReceiptPrintProfileAction::class)->execute()->code,
        );
    }

    /**
     * Lab/validation documents must be unambiguous. The delivered PDF carried
     * `VALIDACION-CAI` and looked like a real fiscal authorization; the engine
     * preview showed a big test notice but the downloaded PDF did not. The real
     * document must carry the same honest notice in its PDF source, while a
     * receipt with no placeholder fiscal data gets none.
     */
    public function test_lab_validation_receipt_carries_the_non_fiscal_notice(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $halfLetter = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();

        $receipt = $this->historicalMediaCartaReceiptFixture($halfLetter);

        // Reproduce the lab placeholders observed in the delivered documents.
        $series = $receipt->series_snapshot;
        $series['range_authorization'] = 'VALIDACION-CAI';
        $invoice = $receipt->invoice_snapshot;
        $invoice['fiscal_cai'] = 'VALIDACION-CAI';
        $receipt->forceFill(['series_snapshot' => $series, 'invoice_snapshot' => $invoice])->save();

        $service = app(InstitutionalReceiptPdfService::class);
        $labHtml = $service->htmlForReceipt($receipt->fresh());

        $this->assertStringContainsString('DOCUMENTO DE PRUEBA - SIN VALIDEZ FISCAL', $labHtml);
        $this->assertStringContainsString('data-receipt-test-notice', $labHtml);
        $this->assertStringStartsWith('%PDF', $service->pdfForReceipt($receipt->fresh()));

        // A normal receipt with authorization data that is not a lab placeholder
        // does not get the test notice.
        $clean = $this->historicalMediaCartaReceiptFixture($halfLetter);
        $cleanHtml = $service->htmlForReceipt($clean);

        $this->assertStringNotContainsString('DOCUMENTO DE PRUEBA - SIN VALIDEZ FISCAL', $cleanHtml);
        $this->assertStringNotContainsString('data-receipt-test-notice', $cleanHtml);
    }

    /** @return array<int, array<string, mixed>> */
    private function catalogSnapshot(): array
    {
        return ReceiptPrintProfile::query()
            ->orderBy('code')
            ->get()
            ->map(fn (ReceiptPrintProfile $profile): array => $profile->toArray())
            ->all();
    }

    /**
     * Synthetic issued receipt under the historical media carta profile. Renders
     * from `profile_snapshot`, exactly like a real issued document.
     */
    private function historicalMediaCartaReceiptFixture(ReceiptPrintProfile $profile): InstitutionalReceipt
    {
        $user = User::factory()->create(['name' => 'Cajera Histórica']);
        $user->assignRole('cajero');

        $cashSession = CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-H',
            'prefix' => 'RH',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 0,
            'range_authorization' => 'AUT-HISTORICO',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'active' => false,
        ]);

        $amountCents = 123456;
        $itemRow = [
            'service_name' => 'Consulta general histórica',
            'category_name' => 'Consulta',
            'area_name' => 'Caja',
            'quantity' => '1.00',
            'unit_price' => '1234.56',
            'unit_price_cents' => $amountCents,
            'tax_rate' => '0.00',
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'line_subtotal' => '1234.56',
            'line_subtotal_cents' => $amountCents,
            'line_total' => '1234.56',
            'line_total_cents' => $amountCents,
            'notes' => null,
        ];

        $receiptNumber = random_int(1, 99999999);
        $receiptNumberFull = 'REC-H'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT);

        return InstitutionalReceipt::query()->create([
            'invoice_id' => null,
            'payment_id' => null,
            'cash_session_id' => $cashSession->id,
            'series_id' => $series->id,
            'receipt_number' => $receiptNumber,
            'receipt_number_full' => $receiptNumberFull,
            'status' => InstitutionalReceipt::STATUS_ISSUED,
            'amount' => '1234.56',
            'amount_cents' => $amountCents,
            'issued_at' => now(),
            'issued_by' => $user->id,
            'payer_name' => 'María López de la Cruz',
            'concept' => 'Servicios hospitalarios de prueba',
            'amount_words' => 'MIL DOSCIENTOS TREINTA Y CUATRO LEMPIRAS CON 56/100 CENTAVOS',
            'template_code' => 'institutional_classic',
            'print_profile_code' => $profile->code,
            // El modo de copia queda congelado en la emisión.
            'copy_mode' => 'original_first_second',
            'institution_snapshot' => [
                'government_line' => 'Gobierno de Honduras',
                'secretariat_line' => 'Secretaría de Salud',
                'hospital_name' => 'Hospital General San Isidro',
                'address' => 'Tocoa, Colón',
                'rtn' => '',
                'phone' => '2444-0000',
                'receipt_location' => 'Tocoa, Colón, Honduras',
                'receipt_footer_text' => 'Copia generada desde datos del recibo',
                'logo_data_uri' => null,
            ],
            'series_snapshot' => [
                'series' => $series->series,
                'receipt_number_full' => $receiptNumberFull,
                'receipt_number_color' => '#b91c1c',
                'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
                'range_authorization' => 'AUT-HISTORICO',
            ],
            'profile_snapshot' => [
                'code' => $profile->code,
                'name' => $profile->name,
                'font_family' => $profile->font_family,
                'font_scale' => (string) $profile->font_scale,
                'margin_top_mm' => (string) $profile->margin_top_mm,
                'margin_right_mm' => (string) $profile->margin_right_mm,
                'margin_bottom_mm' => (string) $profile->margin_bottom_mm,
                'margin_left_mm' => (string) $profile->margin_left_mm,
                'paper_kind' => $profile->paper_kind,
                'width_mm' => (string) $profile->width_mm,
                'height_mm' => (string) $profile->height_mm,
                'orientation' => $profile->orientation,
                'show_copy_legend' => (bool) $profile->show_copy_legend,
                'show_physical_seal_space' => (bool) $profile->show_physical_seal_space,
            ],
            'invoice_snapshot' => [
                'invoice_number' => 'INV-HIST-'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT),
                'fiscal_cai' => null,
                'fiscal_range_from' => null,
                'fiscal_range_to' => null,
                'fiscal_valid_until' => null,
                'patient_name' => 'María López',
                'issued_at' => now()->toIso8601String(),
                'tax_label' => 'ISV',
                'tax_rate_snapshot' => null,
                'subtotal_cents' => $amountCents,
                'exempt_amount_cents' => $amountCents,
                'tax_amount_cents' => 0,
                'discount_amount_cents' => 0,
                'total_cents' => $amountCents,
                'paid_amount_cents' => $amountCents,
                'balance_due_cents' => 0,
            ],
            'payment_snapshot' => [
                'selected_payment' => [
                    'method' => 'cash',
                    'amount_cents' => $amountCents,
                    'reference' => null,
                    'paid_at' => now()->toIso8601String(),
                    'cashier_name' => 'Cajera Histórica',
                ],
                'posted_payments' => [],
                'cash_context' => [
                    'cash_register_label' => 'Caja #1',
                    'cashier_name' => 'Cajera Histórica',
                    'opened_at' => now()->toIso8601String(),
                ],
                'issued_by' => ['name' => 'Cajera Histórica'],
            ],
            'items_snapshot' => [$itemRow],
            'reprint_count' => 0,
        ]);
    }

    /** @return array{0: float, 1: float, 2: float, 3: float} */
    private function firstMediaBox(string $pdf): array
    {
        $this->assertSame(1, preg_match('/\/MediaBox\s*\[([^\]]+)\]/', $pdf, $matches), 'PDF must expose a MediaBox');

        $values = array_values(array_filter(
            preg_split('/\s+/', trim($matches[1])) ?: [],
            static fn (string $value): bool => $value !== '',
        ));

        $this->assertCount(4, $values, 'MediaBox must have four numbers');

        return array_map(static fn (string $value): float => (float) $value, $values);
    }
}
