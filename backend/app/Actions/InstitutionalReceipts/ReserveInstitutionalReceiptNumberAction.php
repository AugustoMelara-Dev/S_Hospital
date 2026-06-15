<?php

namespace App\Actions\InstitutionalReceipts;

use App\Models\InstitutionalReceiptSeries;
use Illuminate\Validation\ValidationException;

class ReserveInstitutionalReceiptNumberAction
{
    /**
     * @return array{series: InstitutionalReceiptSeries, number: int, full: string}
     */
    public function execute(): array
    {
        $series = InstitutionalReceiptSeries::query()
            ->where('document_type', InstitutionalReceiptSeries::DOCUMENT_TYPE)
            ->where('active', true)
            ->lockForUpdate()
            ->first();

        if (! $series instanceof InstitutionalReceiptSeries) {
            throw ValidationException::withMessages([
                'series' => 'No hay una serie activa para recibos institucionales.',
            ]);
        }

        $nextNumber = max($series->current_number + 1, $series->min_number);

        if ($nextNumber > $series->max_number) {
            throw ValidationException::withMessages([
                'series' => 'El rango de recibos institucionales esta agotado.',
            ]);
        }

        $series->forceFill([
            'current_number' => $nextNumber,
        ])->save();

        return [
            'series' => $series->refresh(),
            'number' => $nextNumber,
            'full' => $this->formatReceiptNumber($series, $nextNumber),
        ];
    }

    private function formatReceiptNumber(InstitutionalReceiptSeries $series, int $number): string
    {
        $format = $series->number_format ?: '{series}-{number:08}';
        $formatted = preg_replace_callback(
            '/\{number(?::0?(\d+))?\}/',
            static function (array $matches) use ($number): string {
                $width = isset($matches[1]) ? (int) $matches[1] : 0;

                return $width > 0
                    ? str_pad((string) $number, $width, '0', STR_PAD_LEFT)
                    : (string) $number;
            },
            $format
        );

        return strtr($formatted ?? $format, [
            '{series}' => $series->series,
            '{prefix}' => $series->prefix,
        ]);
    }
}
