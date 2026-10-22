<?php

namespace App\Actions\InstitutionalReceipts;

/**
 * Canonical, typed result of the institutional receipt generator.
 *
 * WHY THIS EXISTS (C2-R2 MEDIUM 2 / C3-P2)
 * ----------------------------------------
 * The document stopped being "one page per copy" the moment the two-zone sheet
 * was introduced: two destinations of the same document can share ONE sheet, and
 * a long operation can spread one destination over several pages. Any surface
 * that says "Contiene N páginas (una por copia)" is therefore guessing, and it
 * guesses before the engine has composed anything.
 *
 * This object is the ONE reusable result every surface (settings, preview,
 * download) must read. `page_count` comes from measuring the generated document
 * with a fresh Dompdf instance (`InstitutionalReceiptHtmlBuilder`), never from
 * `count($copyLabels)`; the requested composition is reported next to the one
 * the engine actually used, together with the legible reason of any alternative
 * output. It is not persisted: the generator result is enough.
 *
 * WHAT IT DOES NOT CLAIM
 * ----------------------
 * A correct PDF does not prove that paper left a printer, and the file cannot
 * know the duplex setting of the printer driver. Whenever physical sheets are
 * mentioned, `sheet_assumption` states the one-face assumption explicitly.
 */
final class InstitutionalReceiptDocumentPlan
{
    /**
     * Human label of each supported paper kind. Mirrors the settings catalog so
     * the operator sees the same name in every surface; it is presentation only,
     * the geometry always comes from the measured `width_pt` / `height_pt`.
     */
    private const PAPER_LABELS = [
        'letter_portrait' => 'Carta vertical',
        'letter_landscape' => 'Carta horizontal',
        'half_letter_landscape' => 'Media carta',
        'a5_landscape' => 'A5',
        'a4_portrait' => 'A4',
        'custom_mm' => 'Personalizado',
        'thermal_80mm' => '80 mm',
        'thermal_58mm' => '58 mm',
    ];

    /**
     * @param  list<string>  $copyLabels
     * @param  list<string>  $destinations
     * @param  list<array{sheet: int, destinations: list<string>, pages: int}>  $distribution
     */
    public function __construct(
        private readonly string $html,
        private readonly string $paperKind,
        private readonly string $orientation,
        private readonly float $widthPt,
        private readonly float $heightPt,
        private readonly array $copyLabels,
        private readonly array $destinations,
        private readonly int $pageCount,
        private readonly int $sheetCount,
        private readonly string $requestedComposition,
        private readonly string $usedComposition,
        private readonly array $distribution,
        private readonly bool $alternativeOutput,
        private readonly ?string $alternativeReason,
        private readonly bool $draft,
    ) {}

    public function html(): string
    {
        return $this->html;
    }

    public function pageCount(): int
    {
        return $this->pageCount;
    }

    public function sheetCount(): int
    {
        return $this->sheetCount;
    }

    public function copyCount(): int
    {
        return count($this->copyLabels);
    }

    /**
     * @return list<string>
     */
    public function copyLabels(): array
    {
        return $this->copyLabels;
    }

    /**
     * @return list<string>
     */
    public function destinations(): array
    {
        return $this->destinations;
    }

    public function requestedComposition(): string
    {
        return $this->requestedComposition;
    }

    public function usedComposition(): string
    {
        return $this->usedComposition;
    }

    /**
     * @return list<array{sheet: int, destinations: list<string>, pages: int}>
     */
    public function distribution(): array
    {
        return $this->distribution;
    }

    public function alternativeOutput(): bool
    {
        return $this->alternativeOutput;
    }

    public function alternativeReason(): ?string
    {
        return $this->alternativeReason;
    }

    public function paperLabel(): string
    {
        return self::PAPER_LABELS[$this->paperKind] ?? $this->paperKind;
    }

    /**
     * One truthful line describing the composed document. It speaks of PDF pages
     * (a measured fact) and never equates pages with copies.
     */
    public function headline(): string
    {
        if ($this->alternativeOutput && $this->alternativeReason !== null) {
            return $this->paperLabel().' · '.$this->alternativeReason;
        }

        if ($this->usedComposition === ReceiptSheetComposition::PAIRED) {
            return sprintf(
                '%s · %d ejemplares en 1 página: %s.',
                $this->paperLabel(),
                $this->copyCount(),
                $this->destinationList(),
            );
        }

        return sprintf(
            '%s · %s · %s PDF.',
            $this->paperLabel(),
            $this->copyPhrase(),
            $this->pagePhrase(),
        );
    }

    /**
     * Instruction for the system print dialog. The document already carries the
     * whole copy set, so the operator prints ONE copy of the set and does not
     * multiply it again in the driver dialog.
     */
    public function printInstruction(): string
    {
        return 'El documento ya incluye los ejemplares: imprima una copia del conjunto y no aumente el número de copias en el diálogo de impresión.';
    }

    /**
     * Explicit physical-sheet assumption, only when the document needs more than
     * one PDF page. The file cannot know the printer duplex setting.
     */
    public function sheetAssumption(): ?string
    {
        if ($this->pageCount <= 1) {
            return null;
        }

        return 'Las hojas se estiman suponiendo impresión a una cara; el PDF no conoce la configuración de doble cara de la impresora.';
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'paper' => [
                'kind' => $this->paperKind,
                'label' => $this->paperLabel(),
                'orientation' => $this->orientation,
                'width_pt' => round($this->widthPt, 2),
                'height_pt' => round($this->heightPt, 2),
            ],
            'copies' => [
                'count' => $this->copyCount(),
                'labels' => $this->copyLabels,
                'destinations' => $this->destinations,
            ],
            'page_count' => $this->pageCount,
            'sheet_count' => $this->sheetCount,
            'requested_composition' => $this->requestedComposition,
            'used_composition' => $this->usedComposition,
            'distribution' => $this->distribution,
            'alternative_output' => $this->alternativeOutput,
            'alternative_reason' => $this->alternativeReason,
            'draft' => $this->draft,
            'headline' => $this->headline(),
            'print_instruction' => $this->printInstruction(),
            'sheet_assumption' => $this->sheetAssumption(),
        ];
    }

    private function copyPhrase(): string
    {
        $count = $this->copyCount();

        return $count === 1 ? '1 ejemplar' : $count.' ejemplares';
    }

    private function pagePhrase(): string
    {
        return $this->pageCount === 1 ? '1 página' : $this->pageCount.' páginas';
    }

    private function destinationList(): string
    {
        $destinations = $this->destinations;

        if (count($destinations) <= 1) {
            return $destinations[0] ?? '';
        }

        $last = array_pop($destinations);

        return implode(', ', $destinations).' y '.$last;
    }
}
