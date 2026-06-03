<?php

declare(strict_types=1);

namespace App\Actions\Billing;

use App\Models\FiscalSequence;
use Illuminate\Validation\ValidationException;

class GenerateFiscalNumberAction
{
    /**
     * @return array{sequence: FiscalSequence, invoice_number: string, next_number: int}
     */
    public function execute(): array
    {
        $sequences = FiscalSequence::query()
            ->where('document_type', 'invoice')
            ->where('active', true)
            ->lockForUpdate()
            ->get();

        if ($sequences->count() !== 1) {
            throw ValidationException::withMessages([
                'fiscal_sequence' => $sequences->isEmpty()
                    ? 'No existe una secuencia fiscal activa para facturas.'
                    : 'Existe mas de una secuencia fiscal activa para facturas.',
            ]);
        }

        /** @var FiscalSequence $sequence */
        $sequence = $sequences->first();

        if (trim($sequence->cai) === '') {
            throw ValidationException::withMessages([
                'cai' => 'La secuencia fiscal activa no tiene CAI configurado.',
            ]);
        }

        if ($sequence->valid_until->isPast() && ! $sequence->valid_until->isToday()) {
            throw ValidationException::withMessages([
                'valid_until' => 'La secuencia fiscal activa esta vencida.',
            ]);
        }

        $nextNumber = $sequence->current_number + 1;

        if ($nextNumber < $sequence->min_number || $nextNumber > $sequence->max_number) {
            throw ValidationException::withMessages([
                'current_number' => 'El siguiente correlativo esta fuera del rango autorizado.',
            ]);
        }

        $sequence->forceFill([
            'current_number' => $nextNumber,
        ])->save();

        return [
            'sequence' => $sequence,
            'invoice_number' => $sequence->prefix.'-'.str_pad((string) $nextNumber, 8, '0', STR_PAD_LEFT),
            'next_number' => $nextNumber,
        ];
    }
}
