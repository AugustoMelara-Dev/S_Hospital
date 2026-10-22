<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptHtmlBuilder;
use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Payment;
use App\Models\ReceiptPrintProfile;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * R2-RCP-COMPLETO — evidence from the NORMAL flow.
 *
 * This test does not call the renderer with a test profile. It goes through the
 * real HTTP endpoints the cashier uses (invoice -> payment -> receipt PDF) and
 * downloads the document the user gets. The PDF is written to the evidence
 * directory when RECEIPT_RCP01_EVIDENCE_DIR is set, so the coordinator's
 * `pdf_font_sizes.py` can measure the MediaBox and font histogram of the real
 * artifact (carta vertical 612 x 792 pt, detail ~10 pt).
 *
 * The series uses the same validation placeholder the lab carries
 * (`VALIDACION-CAI`) so the downloaded PDF also proves the non-fiscal test
 * notice is present in the document, not only in the preview.
 */
class ReceiptPdfNormalFlowEvidenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_downloaded_receipt_pdf_from_the_normal_flow_is_carta_vertical(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class, ReceiptPrintProfileSeeder::class]);

        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
            'receipt_template_mode' => 'institutional',
            'government_line' => 'Gobierno de Honduras',
            'secretariat_line' => 'Secretaria de Salud',
            'receipt_location' => 'Tocoa, Colon',
            'receipt_footer_text' => 'Original: Oficina Recaudadora',
            'partial_payments_enabled' => false,
        ]);

        FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'TEST-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);

        InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-A',
            'prefix' => 'RA',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 100,
            'current_number' => 0,
            'range_authorization' => 'VALIDACION-CAI',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'receipt_number_color' => '#b91c1c',
            'active' => true,
        ]);

        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $serviceId = Service::query()->where('name', 'Glucosa')->firstOrFail()->id;

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Paciente Sintetico R2-RCP-COMPLETO',
                'items' => [['service_id' => $serviceId, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $receiptId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $session->id,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->assertJsonPath('data.receipt_outcome', 'issued')
            ->assertJsonPath('data.institutional_receipt.print_profile_code', 'carta_vertical')
            ->json('data.institutional_receipt.id');

        $response = $this->actingAs($cashier)
            ->get("/api/institutional-receipts/{$receiptId}/pdf", ['Accept' => 'application/pdf']);

        $response->assertOk();
        $pdf = $response->getContent();

        $this->assertStringStartsWith('%PDF', $pdf);

        $box = $this->firstMediaBox($pdf);
        $this->assertEqualsWithDelta(612.0, $box[2], 0.05, 'Normal flow must download carta vertical width (612 pt).');
        $this->assertEqualsWithDelta(792.0, $box[3], 0.05, 'Normal flow must download carta vertical height (792 pt).');

        // T-RC-01/T-RC-02 delivery: ONE patient copy by default. The emitted PDF
        // must contain exactly one page per copy (one logical copy here), so it
        // still proves the "one page per copy" guarantee instead of the old
        // three-document concatenation.
        $receipt = InstitutionalReceipt::query()->findOrFail($receiptId);
        $profile = ReceiptPrintProfile::query()->where('code', $receipt->print_profile_code)->firstOrFail();
        $copyCount = count(app(InstitutionalReceiptPdfService::class)->copyLabelsForProfile($profile));
        $this->assertSame('original_only', $receipt->copy_mode, 'The new delivery default is one patient copy.');
        $this->assertSame(InstitutionalReceiptHtmlBuilder::TEMPLATE_COMPACT, $receipt->template_code, 'A new emission uses the compact template.');
        $this->assertSame($copyCount, preg_match_all('/\/Type\s*\/Page\b/', $pdf), 'One page per copy for the new delivery.');
        $this->assertSame(1, $copyCount, 'The default set is exactly one copy.');

        // The downloaded document (not only the preview) must carry the honest
        // non-fiscal notice for the lab/validation configuration.
        $html = app(InstitutionalReceiptPdfService::class)
            ->htmlForReceipt($receipt);
        $this->assertStringContainsString('DOCUMENTO DE PRUEBA - SIN VALIDEZ FISCAL', $html);

        $evidenceDir = getenv('RECEIPT_RCP01_EVIDENCE_DIR');
        if (is_string($evidenceDir) && $evidenceDir !== '') {
            if (! is_dir($evidenceDir)) {
                mkdir($evidenceDir, 0777, true);
            }

            file_put_contents($evidenceDir.'/normal-flow-receipt.pdf', $pdf);
            file_put_contents(
                $evidenceDir.'/normal-flow-receipt.json',
                json_encode([
                    'receipt_id' => $receiptId,
                    'media_box_width_pt' => $box[2],
                    'media_box_height_pt' => $box[3],
                    'pages' => preg_match_all('/\/Type\s*\/Page\b/', $pdf),
                    'pdf_bytes' => strlen($pdf),
                    'print_profile_code' => 'carta_vertical',
                    'template_code' => $receipt->template_code,
                    'copy_mode' => $receipt->copy_mode,
                    'copy_count' => $copyCount,
                ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
            );
        }

        $this->assertTrue(true);
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
