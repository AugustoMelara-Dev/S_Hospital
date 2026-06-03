<?php

namespace App\Actions\Reports;

class ReportAmountBasis
{
    public const BILLED = 'billed';

    public const COLLECTED_PRORATED = 'collected_prorated';

    /**
     * @param  array<string, mixed>  $filters
     */
    public static function fromFilters(array $filters): string
    {
        return self::usesPaymentScope($filters)
            ? self::COLLECTED_PRORATED
            : self::BILLED;
    }

    /**
     * @return array{amount_basis: string, amount_label: string, amount_source: string}
     */
    public static function metadata(string $basis): array
    {
        if ($basis === self::COLLECTED_PRORATED) {
            return [
                'amount_basis' => self::COLLECTED_PRORATED,
                'amount_label' => 'Cobrado asignado proporcionalmente',
                'amount_source' => 'Pagos publicados filtrados, asignados proporcionalmente a items de factura por snapshot historico',
            ];
        }

        return [
            'amount_basis' => self::BILLED,
            'amount_label' => 'Facturado',
            'amount_source' => 'Facturas no anuladas emitidas en el rango, usando snapshots historicos de items',
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public static function usesPaymentScope(array $filters): bool
    {
        return ! empty($filters['cash_session_id'])
            || ! empty($filters['user_id'])
            || ! empty($filters['method']);
    }
}
