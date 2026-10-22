<?php

namespace App\Actions\Receipts;

use Illuminate\Validation\ValidationException;

/**
 * Human reprint reason contract (F012 / HS-PRINT-DELIVERY).
 *
 * Every backend reprint path must receive an operator-authored reason of 5 to 500
 * characters:
 * - legacy invoice receipt reprint (ReprintReceiptAction),
 * - institutional receipt reprint print-event (InstitutionalReceiptPdfService),
 * - institutional receipt reprint PDF request (POST /institutional-receipts/{id}/pdf).
 *
 * The backend never substitutes a canned/automatic string such as
 * "Impresion desde vista de recibo." when the operator did not write one; callers
 * without a human reason receive a 422 validation error. The reason itself is
 * recorded for audit, but it is NOT a counter and must never number a reprint.
 */
final class ReprintReason
{
    public const MIN_LENGTH = 5;

    public const MAX_LENGTH = 500;

    /**
     * @throws ValidationException
     */
    public static function assertValid(?string $reason, string $field = 'reason'): string
    {
        $trimmed = trim((string) $reason);

        if (! self::isValid($trimmed)) {
            throw ValidationException::withMessages([
                $field => 'El motivo de reimpresion es obligatorio y debe tener entre 5 y 500 caracteres.',
            ]);
        }

        return $trimmed;
    }

    public static function isValid(?string $reason): bool
    {
        $length = mb_strlen(trim((string) $reason));

        return $length >= self::MIN_LENGTH && $length <= self::MAX_LENGTH;
    }
}
