<?php

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
        $documentType = 'invoice';
        $sequences = FiscalSequence::query()
            ->where('document_type', $documentType)
            ->where('active', true)
            ->lockForUpdate()
            ->get();

        $specificSequences = $sequences
            ->filter(fn (FiscalSequence $sequence): bool => $sequence->active_document_type === $documentType)
            ->values();
        $legacySequences = $sequences
            ->filter(fn (FiscalSequence $sequence): bool => $sequence->active_document_type === null)
            ->values();
        $invalidSequences = $sequences
            ->filter(fn (FiscalSequence $sequence): bool => $sequence->active_document_type !== null && $sequence->active_document_type !== $documentType)
            ->values();

        if ($invalidSequences->isNotEmpty()) {
            throw ValidationException::withMessages([
                'fiscal_sequence' => 'La configuracion fiscal activa es inconsistente. Revise las secuencias fiscales.',
            ]);
        }

        if ($specificSequences->count() > 1) {
            throw ValidationException::withMessages([
                'fiscal_sequence' => 'Existe mas de una secuencia fiscal activa para facturas.',
            ]);
        }

        if ($specificSequences->count() === 1) {
            /** @var FiscalSequence $sequence */
            $sequence = $specificSequences->first();
        } else {
            if ($legacySequences->count() !== 1) {
                throw ValidationException::withMessages([
                    'fiscal_sequence' => $legacySequences->isEmpty()
                        ? 'No existe una secuencia fiscal activa para facturas.'
                        : 'Existe mas de una secuencia fiscal activa para facturas.',
                ]);
            }

            /** @var FiscalSequence $sequence */
            $sequence = $legacySequences->first();
        }

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
