<?php

namespace App\Actions\Billing;

use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Resolves the invoice-level `dialysis_prescription` flag.
 *
 * The flag may ONLY be set by users with the
 * `patients.mark_dialysis_prescription` permission; cashiers cannot toggle it
 * from the POS UI silently. Shared by the emission path (CreateInvoiceAction)
 * and the prevalidation endpoint so a preview can never show a free basket the
 * requesting user could not actually emit.
 */
class ResolveInvoiceDialysisPrescriptionAction
{
    public function execute(bool $requested, User $issuer): bool
    {
        if (! $requested) {
            return false;
        }

        if (! $issuer->can('patients.mark_dialysis_prescription')) {
            throw ValidationException::withMessages([
                'dialysis_prescription' => 'No tiene permiso para marcar pacientes con receta de dialisis.',
            ]);
        }

        return true;
    }
}
