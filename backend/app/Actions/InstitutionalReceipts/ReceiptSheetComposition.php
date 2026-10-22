<?php

namespace App\Actions\InstitutionalReceipts;

/**
 * Sheet composition of an institutional receipt document.
 *
 * Two compositions exist:
 *
 * - SINGLE: one logical page per destination (copy). This is the historical
 *   behaviour and the fallback whenever the two-zone sheet does not fit.
 * - PAIRED: BOTH destinations of the SAME document stacked on ONE sheet as two
 *   half-sheet zones (patient on top, hospital archive below, cut line between
 *   them). It is the same document — same receipt number and same financial
 *   content — distinguished only by destination, and it is only used when the
 *   real engine proves the two zones fit on one page.
 *
 * This object only decides the distribution of a copy set over sheets and the
 * destination label of each zone. The fit proof (a real Dompdf render) lives in
 * `InstitutionalReceiptHtmlBuilder`, and the paper geometry in `App\Support\PaperSize`.
 */
final class ReceiptSheetComposition
{
    public const SINGLE = 'single';

    public const PAIRED = 'paired';

    /**
     * Configurable destination labels of the stacked zones, in delivery order.
     *
     * @return list<string>
     */
    public function pairDestinations(): array
    {
        $patient = config('institutional_receipts.destinations.patient', 'Ejemplar del paciente');
        $archive = config('institutional_receipts.destinations.archive', 'Ejemplar para archivo del hospital');

        return [
            is_string($patient) && trim($patient) !== '' ? trim($patient) : 'Ejemplar del paciente',
            is_string($archive) && trim($archive) !== '' ? trim($archive) : 'Ejemplar para archivo del hospital',
        ];
    }

    /**
     * Groups the per-destination pages of one document into sheets.
     *
     * For SINGLE every page is its own sheet. For PAIRED the copy set is chunked
     * into groups of two destinations: each group becomes one sheet holding the
     * destinations stacked in order. A copy set that is not an even multiple of
     * two is never squeezed: the trailing destination keeps its own sheet.
     *
     * @param  list<array<string, mixed>>  $pages
     * @return list<array{destinations: list<string|null>, pages: list<array<string, mixed>>}>
     */
    public function sheetsFor(array $pages, string $composition): array
    {
        if ($composition !== self::PAIRED) {
            return array_map(
                static fn (array $page): array => [
                    'destinations' => [null],
                    'pages' => [$page],
                ],
                $pages,
            );
        }

        $destinations = $this->pairDestinations();
        $sheets = [];

        foreach (array_chunk($pages, 2) as $chunk) {
            $sheets[] = [
                'destinations' => array_map(
                    static fn (int $index): ?string => $destinations[$index] ?? null,
                    array_keys($chunk),
                ),
                'pages' => $chunk,
            ];
        }

        return $sheets;
    }

    /**
     * A destination label only exists for a stacked zone; a single-destination
     * sheet keeps the copy legend the profile already declares.
     *
     * @param  array<string, mixed>  $sheet
     */
    public function destinationLabelFor(array $sheet, int $pageIndex): ?string
    {
        $destinations = $sheet['destinations'] ?? null;

        if (! is_array($destinations)) {
            return null;
        }

        $label = $destinations[$pageIndex] ?? null;

        return is_string($label) && trim($label) !== '' ? $label : null;
    }
}
