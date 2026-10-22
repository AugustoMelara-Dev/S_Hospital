<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Actions\InstitutionalReceipts\ResolveReceiptPrintProfileAction;
use App\Models\CashRegisterSession;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Models\User;
use App\Support\PaperSize;
use Barryvdh\DomPDF\Facade\Pdf;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * T-RC-02 — evidence for the NEW compact delivery on an EXISTING installation.
 *
 * The test reproduces the exact lab situation: the portrait row still carries
 * the legacy delivery, the `2026_09_18_000003` migration adopts the new one, and
 * then a NEW emission is rendered with the real Dompdf engine for 1, 2, 5, 10
 * and 11 concepts plus a mixed receipt with one free line.
 *
 * Every page count comes from `getCanvas()->get_page_count()` on the engine (and
 * is cross-checked against the emitted PDF bytes). Files are written only when
 * `RECEIPT_TRC02_EVIDENCE_DIR` is set, so the normal suite does not depend on an
 * evidence directory.
 */
class InstitutionalReceiptTrc02EvidenceTest extends TestCase
{
    use RefreshDatabase;

    private const MIGRATION = 'database/migrations/2026_09_18_000003_adopt_new_receipt_delivery_profile.php';

    public function test_compact_delivery_keeps_one_page_per_copy_for_the_mandated_cases(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        // Existing installation: the portrait row is still the legacy proposal.
        $letter = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();
        $letter->forceFill([
            'template_code' => 'institutional_classic',
            'copies_mode' => 'original_first_second',
        ])->save();

        $migration = include base_path(self::MIGRATION);
        $migration->up();

        // The migration adopts the new delivery; resolution now yields it.
        $profile = app(ResolveReceiptPrintProfileAction::class)->execute();
        $this->assertSame(ReceiptPrintProfile::CODE_LETTER_PORTRAIT, $profile->code);
        $this->assertSame('institutional_compact', $profile->template_code);
        $this->assertSame('original_only', $profile->copies_mode);

        $outputDirectory = trim((string) getenv('RECEIPT_TRC02_EVIDENCE_DIR'));
        $writeEvidence = $outputDirectory !== '';
        if ($writeEvidence) {
            File::ensureDirectoryExists($outputDirectory);
        }

        $cases = [
            'compacto-01-concepto' => [1, false],
            'compacto-02-conceptos' => [2, false],
            'compacto-05-conceptos' => [5, false],
            'compacto-10-conceptos' => [10, false],
            'compacto-11-conceptos' => [11, false],
            'compacto-11-mixto-linea-gratuita' => [10, true],
        ];

        $summary = [];
        $service = app(InstitutionalReceiptPdfService::class);

        foreach ($cases as $name => [$ordinaryCount, $withFreeLine]) {
            $items = $this->ordinaryItems($ordinaryCount);
            if ($withFreeLine) {
                $items[] = $this->lineItem('Eritropoyetina', free: true);
            }

            $receipt = $this->receiptFixture($items, $profile);
            $html = $service->htmlForReceipt($receipt);
            $pdf = $service->pdfForReceipt($receipt);

            $enginePages = $this->enginePageCount($html, $profile);
            $pdfPages = $this->bytePageCount($pdf);
            $box = $this->firstMediaBox($pdf);

            $this->assertSame(1, $enginePages, "{$name}: one page per copy (engine)");
            $this->assertSame($enginePages, $pdfPages, "{$name}: emitted PDF must match the engine");
            $this->assertSame(1, count($service->copyLabelsForProfile($profile)), "{$name}: one copy");

            // No QR, barcode, scan code or internal identifier may reach the
            // patient document.
            foreach (['qr_code', 'barcode', 'scan_code', 'print_profile_code', 'audit', 'user_id'] as $forbidden) {
                $this->assertStringNotContainsString($forbidden, $html, "{$name}: forbidden code {$forbidden}");
            }

            if ($withFreeLine) {
                // The free line stays visible exactly once and the other lines
                // keep their own import.
                $this->assertStringContainsString('Eritropoyetina', $html);
                $this->assertSame(1, substr_count($html, 'Sin cobro'), 'Exactly the free line is marked as free');
                foreach ($this->ordinaryItems($ordinaryCount) as $item) {
                    $this->assertStringContainsString('L. '.$item['line_total'], $html);
                }
            }

            $summary[] = sprintf(
                '%s: %.2f x %.2f pt, engine pages=%d, pdf pages=%d, copies=%d, bytes=%d',
                $name,
                $box[2],
                $box[3],
                $enginePages,
                $pdfPages,
                1,
                strlen($pdf),
            );

            if ($writeEvidence) {
                File::put($outputDirectory.DIRECTORY_SEPARATOR."{$name}.pdf", $pdf);
            }
        }

        $this->assertCount(6, $summary);

        if ($writeEvidence) {
            File::put(
                $outputDirectory.DIRECTORY_SEPARATOR.'resumen.txt',
                implode(PHP_EOL, $summary).PHP_EOL,
            );

            $this->assertFileExists($outputDirectory.DIRECTORY_SEPARATOR.'compacto-11-conceptos.pdf');
            $this->assertFileExists($outputDirectory.DIRECTORY_SEPARATOR.'compacto-11-mixto-linea-gratuita.pdf');
        }
    }

    // ------------------------------------------------------------------
    // Fixtures
    // ------------------------------------------------------------------

    /**
     * @return list<array<string, mixed>>
     */
    private function ordinaryItems(int $count): array
    {
        $items = [];
        for ($index = 1; $index <= $count; $index++) {
            $items[] = $this->lineItem("Servicio hospitalario {$index}", unitPriceCents: 10000 + $index);
        }

        return $items;
    }

    /**
     * @return array<string, mixed>
     */
    private function lineItem(string $name, int $unitPriceCents = 2500, bool $free = false): array
    {
        $unit = $free ? 0 : $unitPriceCents;
        $money = number_format($unit / 100, 2, '.', '');

        return [
            'service_name' => $name,
            'category_name' => 'Consulta',
            'area_name' => 'Caja',
            'quantity' => '1.00',
            'unit_price' => $money,
            'unit_price_cents' => $unit,
            'tax_rate' => '0.00',
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'line_subtotal' => $money,
            'line_subtotal_cents' => $unit,
            'line_total' => $money,
            'line_total_cents' => $unit,
            'notes' => null,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function receiptFixture(array $items, ReceiptPrintProfile $profile): InstitutionalReceipt
    {
        $user = User::factory()->create(['name' => 'Cajera T-RC-02']);
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
            'series' => 'REC-TRC02',
            'prefix' => 'RT',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 0,
            'range_authorization' => 'AUT-REC-TRC02',
            'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
            'active' => false,
        ]);

        $totalCents = array_sum(array_map(
            static fn (array $item): int => (int) $item['line_total_cents'],
            $items,
        ));
        $total = number_format($totalCents / 100, 2, '.', '');
        $receiptNumber = random_int(1, 99999999);

        return InstitutionalReceipt::query()->create([
            'invoice_id' => null,
            'payment_id' => null,
            'cash_session_id' => $cashSession->id,
            'series_id' => $series->id,
            'receipt_number' => $receiptNumber,
            'receipt_number_full' => 'REC-TRC02'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT),
            'status' => InstitutionalReceipt::STATUS_ISSUED,
            'amount' => $total,
            'amount_cents' => $totalCents,
            'issued_at' => Carbon::parse('2026-09-18 08:30:00'),
            'issued_by' => $user->id,
            'payer_name' => 'María López de la Cruz con nombre largo para envolver',
            'concept' => 'Servicios hospitalarios de prueba',
            'amount_words' => 'CIENTO VEINTICINCO LEMPIRAS CON 00/100 CENTAVOS',
            // The new emission snapshots the adopted delivery.
            'template_code' => $profile->template_code,
            'print_profile_code' => $profile->code,
            'copy_mode' => $profile->copies_mode,
            'institution_snapshot' => [
                'government_line' => 'Gobierno de Honduras',
                'secretariat_line' => 'Secretaría de Salud',
                'hospital_name' => 'Hospital General San Isidro',
                'address' => 'Tocoa, Colón',
                'rtn' => '08011999123456',
                'phone' => '2444-0000',
                'receipt_location' => 'Tocoa, Colón, Honduras',
                'receipt_footer_text' => 'Documento de recaudación institucional.',
                'logo_data_uri' => null,
            ],
            'series_snapshot' => [
                'series' => $series->series,
                'receipt_number_full' => 'REC-TRC02'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT),
                'receipt_number_color' => '#b91c1c',
                'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
                'range_authorization' => 'AUT-REC-TRC02',
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
                'template_code' => $profile->template_code,
                'copies_mode' => $profile->copies_mode,
                'show_copy_legend' => (bool) $profile->show_copy_legend,
                'show_physical_seal_space' => (bool) $profile->show_physical_seal_space,
                'use_logo' => false,
            ],
            'invoice_snapshot' => [
                'invoice_number' => 'INV-TRC02-00000001',
                'fiscal_cai' => null,
                'fiscal_range_from' => null,
                'fiscal_range_to' => null,
                'fiscal_valid_until' => null,
                'patient_name' => 'María López',
                'issued_at' => '2026-09-18T08:30:00-06:00',
                'tax_label' => 'ISV',
                'tax_rate_snapshot' => '15.00',
                'subtotal_cents' => $totalCents,
                'exempt_amount_cents' => $totalCents,
                'tax_amount_cents' => 0,
                'discount_amount_cents' => 0,
                'total_cents' => $totalCents,
                'paid_amount_cents' => $totalCents,
                'balance_due_cents' => 0,
            ],
            'payment_snapshot' => [
                'selected_payment' => [
                    'method' => 'cash',
                    'amount' => $total,
                    'amount_cents' => $totalCents,
                    'reference' => null,
                    'paid_at' => '2026-09-18T08:30:00-06:00',
                    'cashier_name' => 'Cajera T-RC-02',
                ],
                'posted_payments' => [],
                'cash_context' => [
                    'cash_register_label' => 'Caja principal',
                    'cashier_name' => 'Cajera T-RC-02',
                    'opened_at' => '2026-09-18T08:00:00-06:00',
                ],
                'issued_by' => ['name' => 'Cajera T-RC-02'],
            ],
            'items_snapshot' => $items,
            'reprint_count' => 0,
        ]);
    }

    // ------------------------------------------------------------------
    // Real-engine measurement
    // ------------------------------------------------------------------

    private function enginePageCount(string $html, ReceiptPrintProfile $profile): int
    {
        $wrapper = Pdf::loadHTML($html);
        $wrapper->setPaper(PaperSize::fromProfile($profile));
        $dompdf = $wrapper->getDomPDF();
        $dompdf->render();

        return $dompdf->getCanvas()->get_page_count();
    }

    private function bytePageCount(string $pdf): int
    {
        return preg_match_all('/\/Type\s*\/Page\b/', $pdf);
    }

    /**
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    private function firstMediaBox(string $pdf): array
    {
        $this->assertSame(1, preg_match('/\/MediaBox\s*\[([^\]]+)\]/', $pdf, $matches));

        $values = array_values(array_filter(
            preg_split('/\s+/', trim($matches[1])) ?: [],
            static fn (string $value): bool => $value !== '',
        ));

        return array_map(static fn (string $value): float => (float) $value, $values);
    }
}
