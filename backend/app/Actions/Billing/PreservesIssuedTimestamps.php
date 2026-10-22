<?php

namespace App\Actions\Billing;

use App\Models\Invoice;
use App\Models\Payment;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;

/**
 * M-W2-FIN-02: preserva timestamps de auditoria que MariaDB reescribe sola.
 *
 * En MariaDB/MySQL con `explicit_defaults_for_timestamp=0` (default de la
 * instancia de laboratorio XAMPP) la primera columna TIMESTAMP de cada tabla
 * recibe implicitamente `DEFAULT current_timestamp() ON UPDATE
 * current_timestamp()`. `invoices.issued_at` y `payments.paid_at` son esa
 * columna en sus tablas y son timestamps historicos: cualquier UPDATE de la fila
 * (registrar un cobro, anular un pago, reversar una factura) que no las asigne
 * explicitamente hace que el motor las reescriba a NOW().
 *
 * Consecuencia real detectada (M-W2-FIN-02): al registrar el segundo pago de una
 * factura, `issued_at` quedaba con la hora del primer cobro; la autorizacion por
 * dia operativo (`InvoiceAccess::wasIssuedDuringCurrentOperationalDay`) pasaba a
 * denegar con 403 y la historia fiscal quedaba corrompida.
 *
 * Importante: una auto-asignacion posterior (`issued_at = issued_at`) NO sirve,
 * porque el valor del motor ya fue reescrito en el UPDATE anterior. Hay que
 * devolver explicitamente el valor original capturado antes del save; en
 * MySQL/MariaDB una columna asignada explicitamente no dispara el auto-update.
 * Es el mismo mecanismo de las migraciones M-W2-DB-01/02 para `opened_at`.
 *
 * Nota: este trait cubre las acciones de facturacion/pagos en alcance de
 * hs-finance. `institutional_receipts.issued_at` y `cash_movements.occurred_at`
 * tienen el mismo riesgo y deben estabilizarse por migracion (dueno hs-db).
 */
trait PreservesIssuedTimestamps
{
    private function preserveInvoiceIssuedAt(Invoice $invoice, mixed $issuedAt): void
    {
        $this->restoreTimestamp('invoices', $invoice->getKey(), 'issued_at', $issuedAt);
    }

    private function preservePaymentPaidAt(Payment $payment, mixed $paidAt): void
    {
        $this->restoreTimestamp('payments', $payment->getKey(), 'paid_at', $paidAt);
    }

    private function restoreTimestamp(string $table, mixed $key, string $column, mixed $value): void
    {
        if ($value === null || $key === null) {
            return;
        }

        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        $formatted = match (true) {
            $value instanceof DateTimeInterface => $value->format('Y-m-d H:i:s'),
            is_string($value) => $value,
            is_int($value), is_float($value) => (string) $value,
            default => null,
        };

        if ($formatted === null || $formatted === '') {
            return;
        }

        DB::table($table)
            ->where('id', $key)
            ->update([$column => $formatted]);
    }
}
