<?php

namespace Tests\Feature\Evidence;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\ReceiptPrintProfile;
use App\Models\ReceiptProfileAssignment;
use App\Models\Service;
use App\Models\TaxRate;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A-05 evidence generator (skipped by default).
 *
 * Run with:
 *   $env:S_HOSPITAL_RECEIPT_EVIDENCE_DIR='...\hospital-ai\evidencia\ENTREGA-20261021\recibos'
 *   php vendor/bin/phpunit --filter ReceiptFormatsEvidenceTest
 *
 * Issues one real receipt per delivery format (letter, half letter, thermal
 * 80 mm, thermal 58 mm) for a 30-line account that mixes 15 %, 18 %, exempt and
 * a free erythropoietin line, with a long patient name and a 6-digit amount.
 * The PDFs are vector (real text). PNG rasterisation needs an external tool
 * (Ghostscript/ImageMagick/poppler) which is not installed on this machine.
 */
class ReceiptFormatsEvidenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_generate_receipt_format_evidence(): void
    {
        $dir = getenv('S_HOSPITAL_RECEIPT_EVIDENCE_DIR');

        if (! is_string($dir) || trim($dir) === '') {
            $this->markTestSkipped('Set S_HOSPITAL_RECEIPT_EVIDENCE_DIR to generate the receipt evidence PDFs.');
        }

        if (! is_dir($dir) && ! mkdir($dir, 0777, true) && ! is_dir($dir)) {
            $this->fail("Cannot create evidence directory: {$dir}");
        }

        $this->seed([RolesAndPermissionsSeeder::class, ReceiptPrintProfileSeeder::class]);

        $rate15 = TaxRate::query()->firstOrCreate(
            ['percentage' => '15.00'],
            ['name' => 'ISV 15 %', 'active' => true, 'is_default' => true],
        );
        $rate18 = TaxRate::query()->firstOrCreate(
            ['percentage' => '18.00'],
            ['name' => 'ISV 18 %', 'active' => true, 'is_default' => false],
        );

        FiscalSetting::query()->updateOrCreate([], [
            'hospital_name' => 'S_Hospital',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_template_mode' => 'institutional',
            'receipt_paper_size' => 'letter',
            'government_line' => 'Gobierno de Honduras',
            'secretariat_line' => 'Secretaria de Salud',
            'receipt_location' => 'Ciudad',
            'receipt_footer_text' => 'Gracias por su pago',
            'phone' => '2444-0000',
            'address' => 'Barrio El Centro',
        ]);

        $user = User::factory()->create(['name' => 'Cajera de Evidencia']);
        $user->assignRole('cajero');

        $cashSession = CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '1000.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $sequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 1,
            'cai' => 'CAI-EVIDENCIA-2026',
            'valid_until' => '2027-12-31',
            'active' => true,
        ]);

        InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'EVID',
            'prefix' => 'EV',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'range_authorization' => 'AUT-EVIDENCIA',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'receipt_number_color' => '#000000',
            'active' => true,
            'reprint_behavior' => InstitutionalReceiptSeries::REPRINT_AUDIT_ONLY,
            'void_behavior' => InstitutionalReceiptSeries::VOID_PERMISSION_REASON_AUDIT,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $formats = [
            'carta' => ReceiptPrintProfile::CODE_LETTER_PORTRAIT,
            'media-carta' => ReceiptPrintProfile::CODE_HALF_LETTER,
            'termica-80mm' => ReceiptPrintProfile::CODE_THERMAL_80,
            'termica-58mm' => ReceiptPrintProfile::CODE_THERMAL_58,
        ];

        // Issue one real principal receipt (letter) and render the same issued
        // document with each delivery profile. The principal-receipt rule keeps
        // thermal as a secondary print, so the clone changes only the frozen
        // profile snapshot (paper geometry/template), never the legal content.
        $base = $this->issueReceipt(ReceiptPrintProfile::CODE_LETTER_PORTRAIT, $rate15, $rate18, $user, $cashSession, $sequence);

        foreach ($formats as $label => $profileCode) {
            $profile = ReceiptPrintProfile::query()->where('code', $profileCode)->firstOrFail();
            $receipt = clone $base;
            $receipt->copy_mode = 'original_only';
            $receipt->template_code = $profile->template_code;
            $receipt->profile_snapshot = $this->profileSnapshot($profile);

            $pdf = app(InstitutionalReceiptPdfService::class)->pdfForReceipt($receipt);

            $this->assertStringStartsWith('%PDF', $pdf);
            $this->assertGreaterThan(2000, strlen($pdf), "{$label}: the PDF must contain real content.");

            $target = rtrim($dir, '\\/').DIRECTORY_SEPARATOR.$label.'.pdf';
            file_put_contents($target, $pdf);
            $this->assertFileExists($target);

            // Text twin for visual review (Edge headless screenshots at the
            // thermal width); the PDF is the printed artifact.
            $html = app(InstitutionalReceiptPdfService::class)->htmlForReceipt($receipt);
            file_put_contents(rtrim($dir, '\\/').DIRECTORY_SEPARATOR.$label.'.html', $html);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function profileSnapshot(ReceiptPrintProfile $profile): array
    {
        return [
            'code' => $profile->code,
            'name' => $profile->name,
            'paper_kind' => $profile->paper_kind,
            'width_mm' => (string) $profile->width_mm,
            'height_mm' => (string) $profile->height_mm,
            'margin_top_mm' => (string) $profile->margin_top_mm,
            'margin_right_mm' => (string) $profile->margin_right_mm,
            'margin_bottom_mm' => (string) $profile->margin_bottom_mm,
            'margin_left_mm' => (string) $profile->margin_left_mm,
            'orientation' => $profile->orientation,
            'template_code' => $profile->template_code,
            'font_family' => $profile->font_family,
            'font_scale' => (string) $profile->font_scale,
            'copies_mode' => 'original_only',
            'show_copy_legend' => (bool) $profile->show_copy_legend,
            'show_physical_seal_space' => (bool) $profile->show_physical_seal_space,
            'use_logo' => (bool) $profile->use_logo,
        ];
    }

    private function issueReceipt(
        string $profileCode,
        TaxRate $rate15,
        TaxRate $rate18,
        User $user,
        CashRegisterSession $cashSession,
        FiscalSequence $sequence,
    ): InstitutionalReceipt {
        $profile = ReceiptPrintProfile::query()->where('code', $profileCode)->firstOrFail();

        // The resolver excludes thermal profiles from the global default, so the
        // evidence uses an explicit global assignment (the same mechanism the
        // admin uses in Ajustes > Impresion to select a thermal profile).
        $profile->forceFill(['active' => true, 'is_global_default' => false])->save();
        ReceiptProfileAssignment::query()->updateOrCreate(
            ['scope_type' => ReceiptProfileAssignment::SCOPE_GLOBAL, 'scope_id' => null],
            ['receipt_print_profile_id' => $profile->id, 'active' => true],
        );

        $items = $this->evidenceItems($rate15, $rate18);
        $subtotalCents = array_sum(array_column($items, 'line_subtotal_cents'));
        $taxCents = array_sum(array_column($items, 'tax_amount_cents'));

        $invoice = Invoice::query()->create([
            'invoice_number' => 'INV-EVID-'.strtoupper(bin2hex(random_bytes(4))),
            'fiscal_sequence_id' => $sequence->id,
            'fiscal_cai' => $sequence->cai,
            'fiscal_range_from' => '000-001-01-00000001',
            'fiscal_range_to' => '000-001-01-99999999',
            'fiscal_valid_until' => $sequence->valid_until,
            'hospital_name' => 'S_Hospital',
            'hospital_address' => 'Barrio El Centro',
            'receipt_template_mode' => 'institutional',
            'receipt_paper_size' => 'letter',
            'receipt_government_line' => 'Gobierno de Honduras',
            'receipt_secretariat_line' => 'Secretaria de Salud',
            'receipt_location' => 'Ciudad',
            'receipt_footer_text' => 'Gracias por su pago',
            'tax_label' => 'ISV',
            'tax_rate_snapshot' => '15.00',
            'patient_name' => 'María de los Ángeles López de la Cruz y Fernández',
            'subtotal' => $this->money($subtotalCents),
            'subtotal_cents' => $subtotalCents,
            'tax_amount' => $this->money($taxCents),
            'tax_amount_cents' => $taxCents,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => $this->money($subtotalCents + $taxCents),
            'total_cents' => $subtotalCents + $taxCents,
            'paid_amount' => $this->money($subtotalCents + $taxCents),
            'paid_amount_cents' => $subtotalCents + $taxCents,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
            'status' => Invoice::STATUS_PAID,
            'cash_session_id' => $cashSession->id,
            'issued_by' => $user->id,
            'issued_at' => now(),
        ]);

        foreach ($items as $item) {
            InvoiceItem::query()->create(array_merge($item, ['invoice_id' => $invoice->id]));
        }

        Payment::query()->create([
            'invoice_id' => $invoice->id,
            'cash_session_id' => $cashSession->id,
            'user_id' => $user->id,
            'method' => Payment::METHOD_CASH,
            'amount' => $this->money($subtotalCents + $taxCents),
            'amount_cents' => $subtotalCents + $taxCents,
            'status' => Payment::STATUS_POSTED,
            'paid_at' => now(),
        ]);

        $receiptId = $this->actingAs($user)
            ->postJson('/api/institutional-receipts', ['invoice_id' => $invoice->id])
            ->assertCreated()
            ->json('data.id');

        return InstitutionalReceipt::query()->findOrFail($receiptId);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function evidenceItems(TaxRate $rate15, TaxRate $rate18): array
    {
        $items = [];

        for ($i = 1; $i <= 10; $i++) {
            $priceCents = $i === 1 ? 12345678 : 10000;
            $items[] = $this->line("Servicio gravado 15% #{$i}", $priceCents, $rate15);
        }

        for ($i = 1; $i <= 10; $i++) {
            $items[] = $this->line("Servicio gravado 18% #{$i}", 10000, $rate18);
        }

        for ($i = 1; $i <= 9; $i++) {
            $items[] = $this->line("Servicio exento #{$i}", 5000, null);
        }

        $items[] = [
            'service_name' => 'Eritropoyetina',
            'category_name' => 'Medicamentos',
            'area_name' => 'Farmacia',
            'quantity' => '1.00',
            'quantity_cents' => 100,
            'unit_price' => '0.00',
            'unit_price_cents' => 0,
            'unit_price_registered' => '25.00',
            'unit_price_registered_cents' => 2500,
            'rule_adjustment' => '25.00',
            'rule_adjustment_cents' => 2500,
            'tax_rate' => '0.00',
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'line_subtotal' => '0.00',
            'line_subtotal_cents' => 0,
            'line_total' => '0.00',
            'line_total_cents' => 0,
            'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
            'special_rule_applied' => true,
            'notes' => null,
        ];

        return $items;
    }

    /**
     * @return array<string, mixed>
     */
    private function line(string $name, int $priceCents, ?TaxRate $rate): array
    {
        $basisPoints = $rate === null ? 0 : (int) round(((float) $rate->percentage) * 100);
        $taxCents = intdiv(($priceCents * $basisPoints) + 5000, 10000);
        $totalCents = $priceCents + $taxCents;

        return [
            'service_name' => $name,
            'category_name' => 'Consulta',
            'area_name' => 'Caja',
            'quantity' => '1.00',
            'quantity_cents' => 100,
            'unit_price' => $this->money($priceCents),
            'unit_price_cents' => $priceCents,
            'unit_price_registered' => $this->money($priceCents),
            'unit_price_registered_cents' => $priceCents,
            'rule_adjustment' => '0.00',
            'rule_adjustment_cents' => 0,
            'tax_rate' => $rate === null ? '0.00' : number_format((float) $rate->percentage, 2, '.', ''),
            'tax_amount' => $this->money($taxCents),
            'tax_amount_cents' => $taxCents,
            'line_subtotal' => $this->money($priceCents),
            'line_subtotal_cents' => $priceCents,
            'line_total' => $this->money($totalCents),
            'line_total_cents' => $totalCents,
            'special_rule_code' => null,
            'special_rule_applied' => false,
            'notes' => null,
        ];
    }

    private function money(int $cents): string
    {
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
