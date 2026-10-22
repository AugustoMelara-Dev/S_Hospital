<?php

namespace App\Actions\Billing;

use App\Models\FiscalSetting;

/**
 * Single source of truth for the invoice tax rate.
 *
 * Both the emission path (CreateInvoiceAction) and the prevalidation/HTTP
 * preview (PreviewInvoiceTotalsAction) resolve the rate here so the POS
 * preview reconciles with the invoice that is actually issued.
 *
 * Scope note: the `15.00` returned as `code_default` is the safe default the
 * emission path already used before this action existed
 * (InvoiceCreationTest::test_invoice_uses_safe_defaults_when_fiscal_settings_are_missing).
 * It is a pre-existing code default, NOT a new fiscal decision; the `origin`
 * field exists precisely so the number is never silent. Changing the
 * configured rate remains a fiscal decision outside this action.
 */
class ResolveInvoiceTaxRateAction
{
    public const ORIGIN_FISCAL_SETTINGS = 'fiscal_settings';

    public const ORIGIN_CODE_DEFAULT = 'code_default';

    public const ORIGIN_UNAVAILABLE = 'unavailable';

    private const CODE_DEFAULT_RATE = '15.00';

    private const CODE_DEFAULT_BASIS_POINTS = 1500;

    /**
     * @return array{available: bool, rate: ?string, rate_basis_points: ?int, origin: string}
     */
    public function execute(?FiscalSetting $settings = null): array
    {
        $settings ??= FiscalSetting::query()->first();

        if ($settings === null) {
            return $this->fromStoredRate(null);
        }

        $raw = $settings->getAttributes()['default_tax_rate'] ?? null;

        if (is_float($raw) || is_int($raw)) {
            // SQLite may return the decimal column as a native number.
            $raw = number_format((float) $raw, 2, '.', '');
        }

        return $this->fromStoredRate(is_string($raw) ? $raw : null);
    }

    /**
     * Pure resolution used by execute() and by unit tests so the
     * "unavailable" branch is deterministic without corrupting the schema.
     *
     * @return array{available: bool, rate: ?string, rate_basis_points: ?int, origin: string}
     */
    public function fromStoredRate(?string $storedRate): array
    {
        if ($storedRate === null) {
            return [
                'available' => true,
                'rate' => self::CODE_DEFAULT_RATE,
                'rate_basis_points' => self::CODE_DEFAULT_BASIS_POINTS,
                'origin' => self::ORIGIN_CODE_DEFAULT,
            ];
        }

        $normalized = trim($storedRate);

        if ($normalized === '' || ! preg_match('/^\d+(\.\d{1,2})?$/', $normalized)) {
            return [
                'available' => false,
                'rate' => null,
                'rate_basis_points' => null,
                'origin' => self::ORIGIN_UNAVAILABLE,
            ];
        }

        [$integer, $decimal] = array_pad(explode('.', $normalized, 2), 2, '00');
        $basisPoints = ((int) $integer * 100) + (int) str_pad(substr($decimal, 0, 2), 2, '0');

        return [
            'available' => true,
            'rate' => intdiv($basisPoints, 100).'.'.str_pad((string) ($basisPoints % 100), 2, '0', STR_PAD_LEFT),
            'rate_basis_points' => $basisPoints,
            'origin' => self::ORIGIN_FISCAL_SETTINGS,
        ];
    }
}
