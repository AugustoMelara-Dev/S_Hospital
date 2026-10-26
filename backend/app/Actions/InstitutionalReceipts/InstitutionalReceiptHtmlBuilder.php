<?php

namespace App\Actions\InstitutionalReceipts;

use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Support\HospitalName;
use App\Support\Money;
use App\Support\PaperSize;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;

class InstitutionalReceiptHtmlBuilder
{
    /**
     * Composition returned by `compositionFor()` when the two destinations of the
     * document fit on ONE sheet as two stacked half-sheet zones.
     */
    public const COMPOSITION_PAIRED = ReceiptSheetComposition::PAIRED;

    /**
     * Composition with one logical page per destination. Also the only fallback:
     * a document that does not fit as two stacked zones keeps one legible page
     * per destination instead of hiding lines to force a single sheet.
     */
    public const COMPOSITION_SINGLE = ReceiptSheetComposition::SINGLE;

    /**
     * Legacy institutional layout. Historical receipts snapshot this code and
     * keep rendering their original composition (landscape, thermal, small
     * custom), so a new template never silently rewrites an issued document.
     */
    public const TEMPLATE_CLASSIC = 'institutional_classic';

    /**
     * New principal institutional layout (T-RC-01 / mandate §11): a single
     * compact column designed for carta vertical / A4 vertical that keeps 1-11
     * ordinary lines on one page per copy. Only the portrait profiles seeded for
     * NEW installations snapshot this code; historical documents keep classic.
     */
    public const TEMPLATE_COMPACT = 'institutional_compact';

    /**
     * Dedicated thermal (roll) layout for 80 mm / 58 mm paper.
     *
     * A thermal receipt is NOT a shrunk letter: the usable width is 72 mm on
     * 80 mm paper and 48 mm on 58 mm paper, the margins are 0-2 mm, the type is
     * mono/sans at least 8 pt (9 pt in totals), every stroke is pure black and
     * the page height follows the content (continuous roll). Historical
     * receipts never carry this code; only new thermal profiles do.
     */
    public const TEMPLATE_THERMAL = 'institutional_thermal';

    /**
     * Usable width in mm of the thermal rolls. The physical paper is 80/58 mm;
     * these are the areas a thermal head can actually print, so the document
     * never draws outside them.
     */
    private const THERMAL_USABLE_WIDTH_MM = [
        'thermal_80mm' => 72.0,
        'thermal_58mm' => 48.0,
    ];

    private const THERMAL_MIN_HEIGHT_MM = 30.0;

    private const THERMAL_MAX_HEIGHT_MM = 1200.0;

    private const THERMAL_HEIGHT_SAFETY_MM = 3.0;

    /**
     * @var array<string, array{0: int, 1: int, 2: float, 3: float}>
     */
    private array $thermalPaperCache = [];

    public function __construct(
        private readonly AmountToSpanishWords $amountToSpanishWords = new AmountToSpanishWords,
        private readonly ReceiptSheetComposition $sheetComposition = new ReceiptSheetComposition,
    ) {}

    /**
     * Copy labels in delivery order. Every match arm is a literal list, so the
     * result is a `list<string>` (ORIGINAL / PRIMERA COPIA / SEGUNDA COPIA order
     * is part of the contract used by the PDF, the preview and the settings UI).
     *
     * Destination labels of the two stacked zones of a PAIRED sheet are a
     * different, explicit axis (patient / hospital archive); see
     * `ReceiptSheetComposition::pairDestinations()`. The copy labels above stay
     * unchanged so a print event keeps recording the same copy set.
     *
     * @return list<string>
     */
    public function copyLabels(string $copyMode): array
    {
        return match ($copyMode) {
            'original_first' => ['ORIGINAL', 'PRIMERA COPIA'],
            'original_first_second' => ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'],
            default => ['ORIGINAL'],
        };
    }

    /**
     * Number of logical copies (pages of the copy set) a copy mode produces.
     * Used by the preview/dialog to state how many pages the PDF will contain:
     * "una copia del conjunto" so the operator does not print the set three times.
     */
    public function copyCount(string $copyMode): int
    {
        return count($this->copyLabels($copyMode));
    }

    /**
     * @param  string|null  $reprintLabel  Explicit `REIMPRESIÓN #n` override. The
     *                                     POST /pdf reprint path reserves a number under the row lock and renders
     *                                     that exact consumed number; passing null keeps deriving the label from
     *                                     the persistent counter (`reprintLabelFor`).
     */
    public function forReceipt(InstitutionalReceipt $receipt, bool $draft = false, ?string $reprintLabel = null): string
    {
        $profile = $this->normalizedProfile($receipt->profile_snapshot);
        $pages = $this->pagesForReceipt($receipt, $draft, $reprintLabel ?? $this->reprintLabelFor($receipt));
        $composition = $this->compositionFor($receipt->template_code, $receipt->copy_mode, $pages, $profile);

        return $this->render($receipt->template_code, $composition, $pages, $profile);
    }

    /**
     * Canonical result of the generator for an ISSUED receipt.
     *
     * Unlike `forReceipt()` (which returns only the HTML), this measures the
     * generated document with a fresh Dompdf instance and reports the real page
     * count, the requested vs used composition and the distribution of the copy
     * set over those pages. It is the single result every surface (settings,
     * preview, download) must read; it is not persisted.
     */
    public function planForReceipt(InstitutionalReceipt $receipt, bool $draft = false, ?string $reprintLabel = null): InstitutionalReceiptDocumentPlan
    {
        $profile = $this->normalizedProfile($receipt->profile_snapshot);
        $pages = $this->pagesForReceipt($receipt, $draft, $reprintLabel ?? $this->reprintLabelFor($receipt));

        return $this->planForPages($receipt->template_code, $receipt->copy_mode, $pages, $profile, $draft);
    }

    /**
     * Single entry point that turns a copy set into a rendered document. The
     * composition decides the view: the two-zone sheet has its own view, and the
     * paper decides the density inside the compact family (a media carta sheet is
     * a real half sheet and gets the condensed composition of its own; a
     * letter/A4 sheet keeps the roomy one).
     *
     * @param  list<array<string, mixed>>  $pages
     * @param  array<string, mixed>  $profile
     */
    private function render(?string $templateCode, string $composition, array $pages, array $profile): string
    {
        $view = match ($templateCode) {
            self::TEMPLATE_THERMAL => 'pdf.institutional-receipts.thermal',
            self::TEMPLATE_COMPACT => $composition === self::COMPOSITION_PAIRED
                ? 'pdf.institutional-receipts.compact-pair'
                : 'pdf.institutional-receipts.compact',
            default => 'pdf.institutional-receipts.classic',
        };

        return View::make($view, [
            'pages' => $pages,
            'sheets' => $this->sheetComposition->sheetsFor($pages, $composition),
            'profile' => $profile,
            'composition' => $composition,
            'density' => $this->zoneDensityFor($profile, $composition),
            'destinationLabel' => $this->sheetComposition->destinationLabelFor(...),
            'cutLineLabel' => $this->configString('institutional_receipts.cut_line_label', 'Línea de corte'),
            'unknownAdjustmentLabel' => $this->configString('institutional_receipts.unknown_adjustment_label', 'No registrado'),
        ])->render();
    }

    /**
     * Density of the compact family. `full` is the letter/A4 composition (1-11
     * ordinary lines per page, ~10.5 pt detail); `half` is the media carta
     * composition, which is a native half-sheet design: it condenses the
     * institutional masthead, the meta band and the closing/signature block, but
     * keeps the same 14 px (~10.5 pt) detail type so the paper stays readable.
     *
     * @param  array<string, mixed>  $profile
     */
    private function densityFor(array $profile): string
    {
        return ($profile['paper_kind'] ?? null) === 'half_letter_landscape' ? 'half' : 'full';
    }

    /**
     * Density actually used to compose ONE zone of the sheet.
     *
     * A stacked two-zone sheet gives each destination only half of the sheet, so
     * each zone must be composed with the condensed half-sheet density even
     * though the paper itself is letter/A4. Passing the full density here was
     * why the real engine never approved the pair: two roomy compositions cannot
     * share one page, so the document silently fell back to one page per
     * destination. The fit proof (`pairFitsOnOnePage`) must use the same density
     * the final document uses, or it would approve a sheet the renderer then
     * overflows.
     *
     * @param  array<string, mixed>  $profile
     */
    private function zoneDensityFor(array $profile, string $composition): string
    {
        if ($composition === self::COMPOSITION_PAIRED) {
            return 'half';
        }

        return $this->densityFor($profile);
    }

    /**
     * Decides whether the copy set of this document is delivered as ONE sheet with
     * two stacked zones or as one page per destination.
     *
     * Only the compact family is eligible, only a two-destination copy set can be
     * stacked, and only a sheet that can actually host two half-sheet zones
     * (letter portrait / A4 portrait; a media carta sheet is already a half sheet,
     * so it keeps one page per destination). The last word belongs to the real
     * engine: the candidate sheet is rendered and kept only when it lands on
     * exactly one page. Otherwise the per-destination pages are used, so a long
     * operation is never squeezed and no line is hidden.
     *
     * @param  list<array<string, mixed>>  $pages
     * @param  array<string, mixed>  $profile
     */
    private function compositionFor(?string $templateCode, string $copyMode, array $pages, array $profile): string
    {
        if ($this->preferredCompositionFor($templateCode, $copyMode, $pages, $profile) !== self::COMPOSITION_PAIRED) {
            return self::COMPOSITION_SINGLE;
        }

        return $this->pairFitsOnOnePage($pages, $profile)
            ? self::COMPOSITION_PAIRED
            : self::COMPOSITION_SINGLE;
    }

    /**
     * Composition this document ASKS for, before the engine proves it fits.
     *
     * It is the "solicitada" half of the canonical plan: the two-zone sheet is
     * preferred whenever the template, the configuration, the copy set and the
     * paper geometry allow it; the fit proof decides the "usada" one. Keeping the
     * two apart is what lets the plan explain, in legible words, why a document
     * was delivered with a different composition than the preferred one.
     *
     * @param  list<array<string, mixed>>  $pages
     * @param  array<string, mixed>  $profile
     */
    private function preferredCompositionFor(?string $templateCode, string $copyMode, array $pages, array $profile): string
    {
        if ($templateCode !== self::TEMPLATE_COMPACT) {
            return self::COMPOSITION_SINGLE;
        }

        if (! (bool) config('institutional_receipts.two_zone_sheet.enabled', true)) {
            return self::COMPOSITION_SINGLE;
        }

        if (count($pages) !== 2 || count($this->copyLabels($copyMode)) !== 2) {
            return self::COMPOSITION_SINGLE;
        }

        if (($profile['paper_kind'] ?? null) === 'half_letter_landscape') {
            return self::COMPOSITION_SINGLE;
        }

        $minimumHeightMm = $this->configFloat('institutional_receipts.two_zone_sheet.min_paper_height_mm', 250.0);
        $heightPt = $this->paperHeightPt($profile);

        if ($heightPt <= 0.0 || ($heightPt * 25.4 / 72.0) < $minimumHeightMm) {
            return self::COMPOSITION_SINGLE;
        }

        return self::COMPOSITION_PAIRED;
    }

    /**
     * The fit proof. The two stacked zones are a strictly sequential flow, so the
     * engine's page count answers the exact question: one page means both zones
     * fit above the page bottom; two or more means they do not, and the caller
     * falls back. A rendering failure is never treated as a fit.
     *
     * @param  list<array<string, mixed>>  $pages
     * @param  array<string, mixed>  $profile
     */
    private function pairFitsOnOnePage(array $pages, array $profile): bool
    {
        try {
            $html = View::make('pdf.institutional-receipts.compact-pair', [
                'pages' => $pages,
                'sheets' => $this->sheetComposition->sheetsFor($pages, self::COMPOSITION_PAIRED),
                'profile' => $profile,
                'composition' => self::COMPOSITION_PAIRED,
                'density' => $this->zoneDensityFor($profile, self::COMPOSITION_PAIRED),
                'destinationLabel' => $this->sheetComposition->destinationLabelFor(...),
                'cutLineLabel' => $this->configString('institutional_receipts.cut_line_label', 'Línea de corte'),
                'unknownAdjustmentLabel' => $this->configString('institutional_receipts.unknown_adjustment_label', 'No registrado'),
            ])->render();

            $wrapper = Pdf::loadHTML($html);
            $wrapper->setPaper(PaperSize::fromProfileSnapshot($profile));
            $dompdf = $wrapper->getDomPDF();
            $dompdf->render();

            return $dompdf->getCanvas()->get_page_count() === 1;
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @param  array<string, mixed>  $profile
     */
    private function paperHeightPt(array $profile): float
    {
        try {
            $paper = PaperSize::fromProfileSnapshot($profile);
        } catch (\Throwable) {
            return 0.0;
        }

        return (float) $paper[3];
    }

    /**
     * Paper geometry of a thermal document: fixed roll width, content-driven
     * height.
     *
     * A thermal printer cuts a continuous roll, so a 200 mm page with 40 mm of
     * content produces a long blank tail. The height is measured on the real
     * engine with a single copy (the copy set only adds forced page breaks) and
     * the smallest height that keeps that copy on ONE page is used. A small
     * safety margin absorbs the copy label/destination line.
     *
     * @return array{0: int, 1: int, 2: float, 3: float}
     */
    public function paperForReceipt(InstitutionalReceipt $receipt, bool $draft = false, ?string $reprintLabel = null): array
    {
        $profile = $this->normalizedProfile($receipt->profile_snapshot);

        if ($receipt->template_code !== self::TEMPLATE_THERMAL) {
            return PaperSize::fromProfileSnapshot($profile);
        }

        return $this->thermalPaperForPages(
            $this->pagesForReceipt($receipt, $draft, $reprintLabel ?? $this->reprintLabelFor($receipt)),
            $profile,
        );
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: int, 1: int, 2: float, 3: float}
     */
    public function paperForDraft(array $data, ReceiptPrintProfile $profile, ?InstitutionalReceiptSeries $series = null): array
    {
        $normalized = $this->profileFromModel($profile);

        if ($profile->template_code !== self::TEMPLATE_THERMAL) {
            return PaperSize::fromProfileSnapshot($normalized);
        }

        return $this->thermalPaperForPages($this->draftPages($data, $profile, $series), $normalized);
    }

    /**
     * @param  list<array<string, mixed>>  $pages
     * @param  array<string, mixed>  $profile
     * @return array{0: int, 1: int, 2: float, 3: float}
     */
    private function thermalPaperForPages(array $pages, array $profile): array
    {
        $paper = PaperSize::fromProfileSnapshot($profile);
        $paperKind = $profile['paper_kind'] ?? null;

        if (! is_string($paperKind) || ! array_key_exists($paperKind, self::THERMAL_USABLE_WIDTH_MM)) {
            return $paper;
        }

        if ($pages === []) {
            return $paper;
        }

        /*
         * Measure ONE copy. Rendering the full copy set would count the forced
         * `page-break-after` of each destination as content height and inflate
         * every page of the roll; all copies share the same content, so the
         * first one is the representative sample.
         */
        $sample = $this->render(self::TEMPLATE_THERMAL, self::COMPOSITION_SINGLE, [$pages[0]], $profile);
        $widthPt = (float) $paper[2];
        $cacheKey = md5($sample.'|'.$widthPt);

        if (isset($this->thermalPaperCache[$cacheKey])) {
            return $this->thermalPaperCache[$cacheKey];
        }

        $minPt = self::THERMAL_MIN_HEIGHT_MM * 72 / 25.4;
        $maxPt = self::THERMAL_MAX_HEIGHT_MM * 72 / 25.4;
        $low = $minPt;
        $high = $maxPt;

        if ($this->thermalPageCount($sample, $widthPt, $low) === 1) {
            $best = $low;
        } else {
            $best = $maxPt;

            /*
             * The page count is monotonic in height (taller paper never needs
             * more pages), so a binary search finds the shortest roll that keeps
             * the copy on one page.
             */
            for ($iteration = 0; $iteration < 9; $iteration++) {
                $mid = ($low + $high) / 2;

                if ($this->thermalPageCount($sample, $widthPt, $mid) === 1) {
                    $best = $mid;
                    $high = $mid;
                } else {
                    $low = $mid;
                }
            }
        }

        $heightPt = min(
            $maxPt,
            $best + (self::THERMAL_HEIGHT_SAFETY_MM * 72 / 25.4),
        );

        $result = [0, 0, $widthPt, $heightPt];

        if (count($this->thermalPaperCache) >= 64) {
            $this->thermalPaperCache = [];
        }

        $this->thermalPaperCache[$cacheKey] = $result;

        return $result;
    }

    private function thermalPageCount(string $html, float $widthPt, float $heightPt): int
    {
        try {
            $wrapper = Pdf::loadHTML($html);
            $wrapper->setPaper([0, 0, $widthPt, $heightPt]);
            $dompdf = $wrapper->getDomPDF();
            $dompdf->render();

            return (int) $dompdf->getCanvas()->get_page_count();
        } catch (\Throwable) {
            return PHP_INT_MAX;
        }
    }

    /**
     * Builds the canonical plan of one copy set.
     *
     * The page count is MEASURED on the generated document: a brand-new Dompdf
     * wrapper is created for this document only (`measuredPageCount`), so no
     * instance already contaminated by a previous render is reused. The fit proof
     * keeps its own instance too. Counting copies is never an answer here.
     *
     * @param  list<array<string, mixed>>  $pages
     * @param  array<string, mixed>  $profile
     */
    private function planForPages(?string $templateCode, string $copyMode, array $pages, array $profile, bool $draft, ?string $forcedComposition = null): InstitutionalReceiptDocumentPlan
    {
        $requested = $forcedComposition ?? $this->preferredCompositionFor($templateCode, $copyMode, $pages, $profile);
        $used = $forcedComposition ?? $this->compositionFor($templateCode, $copyMode, $pages, $profile);

        $html = $this->render($templateCode, $used, $pages, $profile);
        $paper = $templateCode === self::TEMPLATE_THERMAL
            ? $this->thermalPaperForPages($pages, $profile)
            : PaperSize::fromProfileSnapshot($profile);
        $copyLabels = $this->copyLabels($copyMode);
        $sheets = $this->sheetComposition->sheetsFor($pages, $used);
        $pageCount = $this->measuredPageCount($html, $paper);
        $sheetCount = count($sheets);

        $distribution = $this->distributionFor($templateCode, $used, $sheets, $pageCount, $paper, $profile);
        $alternativeOutput = $requested !== $used || $pageCount > $sheetCount;
        $paperKind = $profile['paper_kind'] ?? null;

        return new InstitutionalReceiptDocumentPlan(
            html: $html,
            paperKind: is_string($paperKind) ? $paperKind : '',
            orientation: $paper[2] >= $paper[3] ? 'landscape' : 'portrait',
            widthPt: (float) $paper[2],
            heightPt: (float) $paper[3],
            copyLabels: $copyLabels,
            destinations: $this->destinationsFor($used, $copyLabels),
            pageCount: $pageCount,
            sheetCount: $sheetCount,
            requestedComposition: $requested,
            usedComposition: $used,
            distribution: $distribution,
            alternativeOutput: $alternativeOutput,
            alternativeReason: $this->alternativeReasonFor($requested, $used, $pageCount, $sheetCount, count($copyLabels)),
            draft: $draft,
        );
    }

    /**
     * Real page count of one generated document, on a FRESH engine instance.
     *
     * Reusing a wrapper that already rendered a previous document is exactly what
     * would report a contaminated count; a new wrapper per document makes the
     * measurement belong to the bytes that are delivered.
     *
     * @param  array{0: int, 1: int, 2: float, 3: float}  $paper
     */
    private function measuredPageCount(string $html, array $paper): int
    {
        $wrapper = Pdf::loadHTML($html);
        $wrapper->setPaper($paper);
        $dompdf = $wrapper->getDomPDF();
        $dompdf->render();

        return (int) $dompdf->getCanvas()->get_page_count();
    }

    /**
     * How the copy set is distributed over the pages of the document.
     *
     * Each `.receipt-page` block starts a new page (`page-break-after: always`), so
     * when the measured total equals the number of blocks every block is exactly
     * one page and no extra render is needed. When the total is larger, the blocks
     * are measured one by one to attribute the overflow instead of guessing it
     * from the copy count.
     *
     * @param  list<array{destinations: list<string|null>, pages: list<array<string, mixed>>}>  $sheets
     * @param  array{0: int, 1: int, 2: float, 3: float}  $paper
     * @param  array<string, mixed>  $profile
     * @return list<array{sheet: int, destinations: list<string>, pages: int}>
     */
    private function distributionFor(?string $templateCode, string $composition, array $sheets, int $pageCount, array $paper, array $profile): array
    {
        $distribution = [];

        if ($pageCount === count($sheets)) {
            foreach ($sheets as $index => $sheet) {
                $distribution[] = [
                    'sheet' => $index + 1,
                    'destinations' => $this->sheetDestinations($sheet),
                    'pages' => 1,
                ];
            }

            return $distribution;
        }

        foreach ($sheets as $index => $sheet) {
            $sheetHtml = $this->render($templateCode, $composition, $sheet['pages'], $profile);

            $distribution[] = [
                'sheet' => $index + 1,
                'destinations' => $this->sheetDestinations($sheet),
                'pages' => $this->measuredPageCount($sheetHtml, $paper),
            ];
        }

        return $distribution;
    }

    /**
     * Destination labels of one sheet, in zone order. A stacked zone has its own
     * destination label; a single-destination sheet keeps the copy legend the
     * profile already declares.
     *
     * @param  array{destinations: list<string|null>, pages: list<array<string, mixed>>}  $sheet
     * @return list<string>
     */
    private function sheetDestinations(array $sheet): array
    {
        $labels = [];

        foreach ($sheet['pages'] as $index => $page) {
            $label = $this->sheetComposition->destinationLabelFor($sheet, $index)
                ?? $this->stringValue($page['copy_label'] ?? null, '');

            if ($label !== '') {
                $labels[] = $label;
            }
        }

        return $labels;
    }

    /**
     * Distinct destinations of the whole document, in delivery order. Used by the
     * headline so two stacked zones are named, not counted as two pages.
     *
     * @param  list<string>  $copyLabels
     * @return list<string>
     */
    private function destinationsFor(string $composition, array $copyLabels): array
    {
        if ($composition !== self::COMPOSITION_PAIRED) {
            return $copyLabels;
        }

        return $this->sheetComposition->pairDestinations();
    }

    /**
     * Legible reason of a delivered composition other than the preferred one.
     *
     * Two cases are distinguished because they mean different things to the
     * operator: the two-zone sheet did not admit the detail (so each destination
     * gets a full page), or one given destination alone needed more than one page.
     */
    private function alternativeReasonFor(string $requested, string $used, int $pageCount, int $sheetCount, int $copyCount): ?string
    {
        if ($requested === self::COMPOSITION_PAIRED && $used !== self::COMPOSITION_PAIRED) {
            return 'La hoja de dos zonas no admitió el detalle: se emitió una página completa por ejemplar, sin ocultar líneas.';
        }

        if ($pageCount > $sheetCount) {
            $copies = $copyCount === 1 ? '1 ejemplar' : $copyCount.' ejemplares';

            return 'El detalle necesita páginas adicionales: '.$copies.', '.$pageCount.' páginas PDF.';
        }

        return null;
    }

    /**
     * Single source of the template resolution. The receipt snapshots the
     * template it was issued with, so a historical document keeps its own
     * composition; an unknown/legacy value falls back to classic, never to an
     * unhandled error. Only the explicit compact code selects the compact family;
     * the compact family then decides between the single and the two-zone views
     * from the composition (see `render()`).
     */
    public function templateView(?string $templateCode): string
    {
        return match ($templateCode) {
            self::TEMPLATE_THERMAL => 'pdf.institutional-receipts.thermal',
            self::TEMPLATE_COMPACT => 'pdf.institutional-receipts.compact',
            default => 'pdf.institutional-receipts.classic',
        };
    }

    /**
     * HS-PRINT-DELIVERY: legend source for the reprint mark.
     *
     * The number comes from the persistent counter `institutional_receipts.reprint_count`
     * (plus the recorded print events that prove a previous logical delivery). It never
     * comes from COUNT(audit_logs), which is prunable and only an audit trail.
     *
     * - No recorded print yet: this is the first document of the issued receipt, so it
     *   must never be labeled as a reprint.
     * - Otherwise: the next reprint number is reprint_count + 1 (a first print event
     *   without reprints yields #1; after one recorded reprint the next legend is #2).
     *
     * The legend marks a logical reprint request/delivery; it does not prove that paper
     * physically left a printer.
     */
    public function reprintLabelFor(InstitutionalReceipt $receipt): ?string
    {
        $hasRecordedPrint = $receipt->printEvents()->exists();

        if ((int) $receipt->reprint_count <= 0 && ! $hasRecordedPrint) {
            return null;
        }

        return 'REIMPRESIÓN #'.max(1, (int) $receipt->reprint_count + 1);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function forDraft(array $data, ReceiptPrintProfile $profile, ?InstitutionalReceiptSeries $series = null): string
    {
        /*
         * Un borrador usa la MISMA decisión de composición que la emisión.
         *
         * Antes forzaba `single` con el argumento de que «el borrador es un
         * conjunto de una sola copia», pero eso no era cierto: `draftPages()`
         * construye una página por etiqueta de `copies_mode`, igual que la
         * emisión. Con dos ejemplares sobre carta, la vista previa anunciaba dos
         * páginas mientras el documento emitido cabía en una hoja de dos zonas.
         *
         * El borrador NO consume correlativo, no crea factura, pago ni recibo y no
         * registra evento de reimpresión: eso no cambia. Lo único que cambia es que
         * la distribución se decide con la misma función que la emisión.
         */
        $pages = $this->draftPages($data, $profile, $series);
        $normalized = $this->profileFromModel($profile);
        $composition = $this->compositionFor(
            $profile->template_code,
            $profile->copies_mode,
            $pages,
            $normalized,
        );

        return $this->render($profile->template_code, $composition, $pages, $normalized);
    }

    /**
     * Canonical result of the generator for a DRAFT (unsaved profile / test print).
     *
     * The draft keeps its documented single-copy-set composition, so the plan
     * reports it as both requested and used: the sample document the operator is
     * about to test-print is measured as it really is.
     *
     * @param  array<string, mixed>  $data
     */
    public function planForDraft(array $data, ReceiptPrintProfile $profile, ?InstitutionalReceiptSeries $series = null): InstitutionalReceiptDocumentPlan
    {
        /*
         * Sin composición forzada: el plan del borrador se decide con las mismas
         * reglas que el emitido (`preferredCompositionFor` + la prueba de cabida
         * del motor real). Así, para contenido y configuración equivalentes, ambas
         * rutas declaran el mismo papel, la misma densidad por zona, los mismos
         * ejemplares y destinos, la misma alternativa por desbordamiento y el
         * mismo número de páginas medido.
         *
         * Lo que sigue siendo distinto y NO se exige igual: número, fecha, marca de
         * prueba y metadatos del PDF. La correspondencia es semántica y de
         * geometría, no binaria.
         */
        return $this->planForPages(
            $profile->template_code,
            $profile->copies_mode,
            $this->draftPages($data, $profile, $series),
            $this->profileFromModel($profile),
            true,
        );
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array<string, mixed>>
     */
    private function draftPages(array $data, ReceiptPrintProfile $profile, ?InstitutionalReceiptSeries $series = null): array
    {
        $settings = FiscalSetting::query()->firstOrNew();
        $amount = $this->moneyValue(null, $data['amount'] ?? null);
        $payerName = $this->stringValue($data['payer_name'] ?? null, 'Paciente de prueba');
        $concept = $this->stringValue($data['concept'] ?? null, 'Servicios hospitalarios de prueba');
        $watermark = $this->stringValue($data['watermark'] ?? null, 'PRUEBA - SIN VALIDEZ');
        $amountWords = $this->stringValue($data['amount_words'] ?? null, $watermark);
        $amountStatement = $this->stringValue(
            $data['amount_statement'] ?? null,
            $this->amountStatement($series?->legal_text, $amountWords),
        );
        $amountTotalNote = $this->stringValue($data['amount_total_note'] ?? null);
        $invoiceDraft = is_array($data['invoice'] ?? null) ? $data['invoice'] : [];
        $items = $this->draftItems($data, $concept, $amount);

        $logo = $this->logoDataUriForProfile($profile);

        if ($profile->template_code === self::TEMPLATE_THERMAL) {
            $logo = $this->monochromeLogoDataUri($logo);
        }

        $institution = [
            'government_line' => $settings->government_line ?: '',
            'secretariat_line' => $settings->secretariat_line ?: '',
            'hospital_name' => HospitalName::display($settings->hospital_name),
            'rtn' => $settings->rtn ?: '',
            'address' => $settings->address ?: '',
            'phone' => $settings->phone ?: '',
            'receipt_location' => $settings->receipt_location ?: '',
            'receipt_footer_text' => $settings->receipt_footer_text ?: '',
            'logo_data_uri' => $logo,
        ];

        $invoice = [
            'invoice_number' => 'PRUEBA-SIN-FACTURA',
            'fiscal_cai' => null,
            'fiscal_range_from' => null,
            'fiscal_range_to' => null,
            'fiscal_valid_until' => null,
            'patient_name' => $payerName,
            'issued_at' => now()->toIso8601String(),
            'tax_label' => $this->stringValue($invoiceDraft['tax_label'] ?? null, 'ISV'),
            'tax_rate_snapshot' => $invoiceDraft['tax_rate_snapshot'] ?? null,
            'subtotal' => $this->moneyValue(null, $invoiceDraft['subtotal'] ?? $amount),
            'exempt_amount' => $this->moneyValue(null, $invoiceDraft['exempt_amount'] ?? $amount),
            'tax_amount' => $this->moneyValue(null, $invoiceDraft['tax_amount'] ?? '0.00'),
            'discount_amount' => $this->moneyValue(null, $invoiceDraft['discount_amount'] ?? '0.00'),
            'total' => $this->moneyValue(null, $invoiceDraft['total'] ?? $amount),
            'paid_amount' => $this->moneyValue(null, $invoiceDraft['paid_amount'] ?? $amount),
            'balance_due' => $this->moneyValue(null, $invoiceDraft['balance_due'] ?? '0.00'),
            'tax_breakdown' => $this->taxBreakdownFor($invoiceDraft, $items),
        ];

        $pages = [];

        foreach ($this->copyLabels($profile->copies_mode) as $index => $copyLabel) {
            $pages[] = [
                'copy_label' => $copyLabel,
                'copy_index' => $index + 1,
                'copy_total' => $this->copyCount($profile->copies_mode),
                'reprint_label' => null,
                'draft' => true,
                'watermark' => $watermark,
                'institution' => $institution,
                'series' => [
                    'series' => $series?->series ?: 'PRUEBA',
                    'receipt_number_full' => $series ? $this->formatDraftNumber($series) : 'PRUEBA-SIN-NUMERO',
                    'receipt_number_color' => $this->safeHexColor($series?->receipt_number_color),
                    'legal_text' => $series?->legal_text ?: '',
                ],
                'amount' => $amount,
                'issued_at' => now(),
                'payer_name' => $payerName,
                'amount_words' => $amountWords,
                'amount_statement' => $amountStatement,
                'amount_total_note' => $amountTotalNote !== '' ? $amountTotalNote : null,
                'concept' => $concept,
                'status' => 'issued',
                'invoice' => $invoice,
                'payment' => [
                    'selected_payment' => null,
                    'posted_payments' => [],
                    'cash_context' => [
                        'cash_register_label' => null,
                        'cashier_name' => null,
                        'opened_at' => null,
                    ],
                    'issued_by' => [
                        'name' => null,
                    ],
                ],
                'items' => $items,
            ];
        }

        return $pages;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array<string, mixed>>
     */
    private function draftItems(array $data, string $concept, ?string $amount): array
    {
        $provided = $data['items'] ?? null;

        if (! is_array($provided) || $provided === []) {
            return [[
                'service_name' => $concept,
                'category_name' => null,
                'area_name' => null,
                'quantity' => '1.00',
                'unit_price' => $amount,
                'reference_unit_price' => $amount,
                'tax_rate' => null,
                'tax_amount' => '0.00',
                'line_subtotal' => $amount,
                'line_total' => $amount,
                'adjustment' => null,
                'adjustment_unknown' => false,
                'rule_adjusted' => false,
                'notes' => null,
            ]];
        }

        return array_values(collect($provided)
            ->filter(fn (mixed $item): bool => is_array($item))
            ->map(fn (array $item): array => [
                'service_name' => $this->stringValue($item['service_name'] ?? null, 'Servicio hospitalario'),
                'category_name' => $this->stringValue($item['category_name'] ?? null),
                'area_name' => $this->stringValue($item['area_name'] ?? null),
                'quantity' => $this->numericString($item['quantity'] ?? null, '1.00'),
                'unit_price' => $this->moneyValue($item['unit_price_cents'] ?? null, $item['unit_price'] ?? null),
                'reference_unit_price' => $this->moneyValue(
                    $item['unit_price_registered_cents'] ?? null,
                    $item['unit_price_registered'] ?? $item['unit_price'] ?? null,
                ),
                'tax_rate' => $item['tax_rate'] ?? null,
                'tax_amount' => $this->moneyValue($item['tax_amount_cents'] ?? null, $item['tax_amount'] ?? null),
                'line_subtotal' => $this->moneyValue($item['line_subtotal_cents'] ?? null, $item['line_subtotal'] ?? null),
                'line_total' => $this->moneyValue($item['line_total_cents'] ?? null, $item['line_total'] ?? null),
                'adjustment' => $this->lineAdjustmentValue($item),
                'adjustment_unknown' => false,
                'rule_adjusted' => ($item['special_rule_applied'] ?? false) === true,
                'notes' => $this->stringValue($item['notes'] ?? null),
            ])
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function pagesForReceipt(InstitutionalReceipt $receipt, bool $draft, ?string $reprintLabel = null): array
    {
        $copyLabels = $this->copyLabels($receipt->copy_mode);
        $copyTotal = count($copyLabels);
        // Lab/validation documents must be unambiguous: a downloaded PDF that
        // carries a placeholder fiscal authorization must show the same big test
        // notice the preview shows, so it cannot pass for a real fiscal receipt.
        $nonFiscalNotice = $this->nonFiscalNotice($receipt);
        $items = $this->normalizedItems($receipt->items_snapshot ?? []);
        $invoice = $this->normalizedInvoice($receipt->invoice_snapshot ?? [], $items);
        $amounts = $this->amountReference($receipt, $invoice);
        $institution = $this->normalizedInstitution($receipt->institution_snapshot);
        $payment = $this->normalizedPayment($receipt->payment_snapshot ?? []);
        $cashSession = $receipt->invoice?->cashSession;
        $cashContext = $payment['cash_context'] ?? null;

        // Old emissions without a named physical register printed the session PK.
        // Hide only that proven generated fallback; preserve real register names,
        // including names containing '#', and leave persisted snapshots untouched.
        if ($cashSession !== null && $cashSession->cash_register_id === null
            && is_array($cashContext)
            && ($cashContext['cash_register_label'] ?? null) === 'Caja #'.$cashSession->id) {
            $cashContext['cash_register_label'] = 'Caja';
            $payment['cash_context'] = $cashContext;
        }

        if ($receipt->template_code === self::TEMPLATE_THERMAL) {
            $logoDataUri = $institution['logo_data_uri'] ?? null;
            $institution['logo_data_uri'] = $this->monochromeLogoDataUri(is_string($logoDataUri) ? $logoDataUri : null);
        }

        return array_values(collect($copyLabels)
            ->map(fn (string $copyLabel, int $index): array => [
                'copy_label' => $copyLabel,
                'copy_index' => $index + 1,
                'copy_total' => $copyTotal,
                'reprint_label' => $draft ? null : $reprintLabel,
                'draft' => $draft,
                'watermark' => $draft ? 'PRUEBA - SIN VALIDEZ' : null,
                'test_notice' => $nonFiscalNotice,
                'institution' => $institution,
                'series' => $this->normalizedSeries($receipt->series_snapshot, $receipt->receipt_number_full),
                'amount' => Money::formatCents((int) $receipt->amount_cents),
                'issued_at' => $receipt->issued_at,
                'payer_name' => $receipt->payer_name,
                'amount_words' => $receipt->amount_words,
                'amount_statement' => $amounts['statement'],
                'amount_total_note' => $amounts['total_note'],
                'concept' => $receipt->concept,
                'status' => $receipt->status,
                'invoice' => $invoice,
                'payment' => $payment,
                'items' => $items,
            ])
            ->all());
    }

    /**
     * The amount the "en letras" sentence refers to, and the explicit statement of
     * that reference.
     *
     * The institutional legal text ("haber enterado ... la suma de") describes the
     * amount RECEIVED, so the words must describe the amount actually received and
     * never a different figure. Two cases:
     *
     * - Nothing was received (amount zero, or a snapshot that explicitly records a
     *   zero received amount): a legitimate zero. The words of the zero amount are
     *   kept, the "haber enterado" formula is replaced by the configured
     *   without-charge notice, and no sentence claims cash was received.
     * - Something was received: the received amount is spoken. When the received
     *   amount differs from the document total (a partial payment snapshot), the
     *   total is stated separately so the reader can never attribute the words to
     *   the wrong figure.
     *
     * The received amount is read from `invoice_snapshot.paid_amount_cents` when the
     * snapshot really carries it; otherwise the receipt amount itself is the
     * received amount (which is what every pre-existing snapshot means), so a
     * historical document is never reinterpreted.
     *
     * @param  array<string, mixed>  $invoice
     * @return array{statement: string, total_note: string|null}
     */
    private function amountReference(InstitutionalReceipt $receipt, array $invoice): array
    {
        $receiptCents = (int) $receipt->amount_cents;
        $snapshot = is_array($receipt->invoice_snapshot) ? $receipt->invoice_snapshot : [];

        $totalCents = $this->centsOrNull($snapshot['total_cents'] ?? null) ?? $receiptCents;
        $paidCents = $this->centsOrNull($snapshot['paid_amount_cents'] ?? null) ?? $receiptCents;

        $words = trim((string) $receipt->amount_words);
        $legalText = trim($this->stringValue($receipt->series_snapshot['legal_text'] ?? null));

        if ($paidCents <= 0) {
            $withoutCharge = trim($this->configString(
                'institutional_receipts.without_charge_notice',
                'Documento sin cobro: no se recibió efectivo.',
            ));

            return [
                'statement' => trim($words.' '.$withoutCharge),
                'total_note' => null,
            ];
        }

        $paidWords = $paidCents === $receiptCents && $words !== ''
            ? $words
            : $this->amountToSpanishWords->forCents($paidCents);

        return [
            'statement' => $this->amountStatement($legalText !== '' ? $legalText : null, $paidWords),
            'total_note' => $paidCents === $totalCents
                ? null
                : 'Total del documento: L. '.Money::formatCents($totalCents)
                    .' (en letras: '.$this->amountToSpanishWords->forCents($totalCents).').',
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function normalizedInstitution(array $snapshot): array
    {
        return [
            'government_line' => $this->stringValue($snapshot['government_line'] ?? null),
            'secretariat_line' => $this->stringValue($snapshot['secretariat_line'] ?? null),
            'hospital_name' => $this->stringValue($snapshot['hospital_name'] ?? null, 'SIN CONFIGURAR'),
            'address' => $this->stringValue($snapshot['address'] ?? null),
            'rtn' => $this->stringValue($snapshot['rtn'] ?? null),
            'phone' => $this->stringValue($snapshot['phone'] ?? null),
            'receipt_location' => $this->stringValue($snapshot['receipt_location'] ?? null),
            'receipt_footer_text' => $this->stringValue($snapshot['receipt_footer_text'] ?? null),
            'logo_data_uri' => $this->safeImageDataUri($snapshot['logo_data_uri'] ?? null),
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function normalizedSeries(array $snapshot, string $receiptNumberFull): array
    {
        return [
            'series' => $this->stringValue($snapshot['series'] ?? null),
            'receipt_number_full' => $this->stringValue($snapshot['receipt_number_full'] ?? null, $receiptNumberFull),
            'receipt_number_color' => $this->safeHexColor($snapshot['receipt_number_color'] ?? null),
            'legal_text' => $this->stringValue($snapshot['legal_text'] ?? null),
            'range_authorization' => $this->stringValue($snapshot['range_authorization'] ?? null),
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function normalizedProfile(array $snapshot): array
    {
        return [
            'code' => $this->stringValue($snapshot['code'] ?? null),
            'font_family' => $this->safeFontFamily($snapshot['font_family'] ?? null),
            'font_scale' => $this->floatValue($snapshot['font_scale'] ?? null, 1.0),
            'margin_top_mm' => $this->floatValue($snapshot['margin_top_mm'] ?? null, 6.0),
            'margin_right_mm' => $this->floatValue($snapshot['margin_right_mm'] ?? null, 6.0),
            'margin_bottom_mm' => $this->floatValue($snapshot['margin_bottom_mm'] ?? null, 6.0),
            'margin_left_mm' => $this->floatValue($snapshot['margin_left_mm'] ?? null, 6.0),
            'show_copy_legend' => $this->boolValue($snapshot['show_copy_legend'] ?? null, true),
            'show_physical_seal_space' => $this->boolValue($snapshot['show_physical_seal_space'] ?? null, true),
            'paper_kind' => $this->stringValue($snapshot['paper_kind'] ?? null),
            // Paper geometry travels with the profile so the composition can resolve
            // the exact sheet through PaperSize (one geometry source) without
            // re-reading the profile row. `orientation` is informational: the native
            // sheet geometry already encodes it.
            'orientation' => $this->stringValue($snapshot['orientation'] ?? null, 'portrait'),
            'width_mm' => $this->numericString($snapshot['width_mm'] ?? null, ''),
            'height_mm' => $this->numericString($snapshot['height_mm'] ?? null, ''),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function profileFromModel(ReceiptPrintProfile $profile): array
    {
        return $this->normalizedProfile([
            'code' => $profile->code,
            'font_family' => $profile->font_family,
            'font_scale' => $profile->font_scale,
            'margin_top_mm' => $profile->margin_top_mm,
            'margin_right_mm' => $profile->margin_right_mm,
            'margin_bottom_mm' => $profile->margin_bottom_mm,
            'margin_left_mm' => $profile->margin_left_mm,
            'show_copy_legend' => $profile->show_copy_legend,
            'show_physical_seal_space' => $profile->show_physical_seal_space,
            'paper_kind' => $profile->paper_kind,
            'orientation' => $profile->orientation,
            'width_mm' => $profile->width_mm,
            'height_mm' => $profile->height_mm,
        ]);
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @param  list<array<string, mixed>>  $items
     * @return array<string, mixed>
     */
    private function normalizedInvoice(array $snapshot, array $items = []): array
    {
        return [
            'invoice_number' => $snapshot['invoice_number'] ?? '',
            'fiscal_cai' => $snapshot['fiscal_cai'] ?? null,
            'fiscal_range_from' => $snapshot['fiscal_range_from'] ?? null,
            'fiscal_range_to' => $snapshot['fiscal_range_to'] ?? null,
            'fiscal_valid_until' => $snapshot['fiscal_valid_until'] ?? null,
            'patient_name' => $snapshot['patient_name'] ?? '',
            'issued_at' => $snapshot['issued_at'] ?? null,
            'tax_label' => $snapshot['tax_label'] ?? 'ISV',
            'tax_rate_snapshot' => $snapshot['tax_rate_snapshot'] ?? null,
            'subtotal' => $this->moneyValue($snapshot['subtotal_cents'] ?? null, $snapshot['subtotal'] ?? null),
            'exempt_amount' => $this->moneyValue($snapshot['exempt_amount_cents'] ?? null, $snapshot['exempt_amount'] ?? null),
            'tax_amount' => $this->moneyValue($snapshot['tax_amount_cents'] ?? null, $snapshot['tax_amount'] ?? null),
            'discount_amount' => $this->moneyValue($snapshot['discount_amount_cents'] ?? null, $snapshot['discount_amount'] ?? null),
            'total' => $this->moneyValue($snapshot['total_cents'] ?? null, $snapshot['total'] ?? null),
            'paid_amount' => $this->moneyValue($snapshot['paid_amount_cents'] ?? null, $snapshot['paid_amount'] ?? null),
            'balance_due' => $this->moneyValue($snapshot['balance_due_cents'] ?? null, $snapshot['balance_due'] ?? null),
            // Per-rate breakdown (H-08/F2C). New snapshots carry it from
            // CalculateInvoiceTotalsAction; historical snapshots are derived from
            // the per-line snapshot without rewriting anything.
            'tax_breakdown' => $this->taxBreakdownFor($snapshot, $items),
        ];
    }

    /**
     * Tax breakdown of one invoice, as the receipt prints it.
     *
     * Contract (SPEC-F2B / F2C): `tax_breakdown` is a list ordered by rate
     * descending, each row carrying `rate`, `base_cents`, `tax_cents`,
     * `base_label` ("Gravado 15 %" / "Exento") and `tax_label` ("ISV 15 %" /
     * "Exento"). When a snapshot already carries it, the row values are used
     * verbatim; when it does not (historical documents or drafts), the same shape
     * is derived from `items_snapshot` (`tax_rate`, `line_subtotal_cents`,
     * `tax_amount_cents`). The invoice totals are a last resort for a historical
     * snapshot that has no usable per-line tax data.
     *
     * @param  array<string, mixed>  $snapshot
     * @param  list<array<string, mixed>>  $items
     * @return list<array{rate: string, base_cents: int, tax_cents: int, base: string, tax: string, base_label: string, tax_label: string}>
     */
    private function taxBreakdownFor(array $snapshot, array $items): array
    {
        $provided = $snapshot['tax_breakdown'] ?? null;

        if (is_array($provided) && $provided !== []) {
            $rows = [];

            foreach ($provided as $row) {
                if (! is_array($row)) {
                    continue;
                }

                $rate = $this->normalizedRate($row['rate'] ?? null);

                if ($rate === null) {
                    continue;
                }

                $rows[] = $this->taxBreakdownRow(
                    $rate,
                    $this->centsOrNull($row['base_cents'] ?? null) ?? 0,
                    $this->centsOrNull($row['tax_cents'] ?? null) ?? 0,
                    $row['base_label'] ?? null,
                    $row['tax_label'] ?? null,
                );
            }

            if ($rows !== []) {
                return $rows;
            }
        }

        /** @var array<string, array{base: int, tax: int}> $groups */
        $groups = [];

        foreach ($items as $item) {
            $rate = $this->normalizedRate($item['tax_rate'] ?? null) ?? '0.00';
            $baseCents = $this->centsOrNull($item['line_subtotal_cents'] ?? null)
                ?? $this->centsOrNull($item['line_subtotal'] ?? null)
                ?? 0;
            $taxCents = $this->centsOrNull($item['tax_amount_cents'] ?? null)
                ?? $this->centsOrNull($item['tax_amount'] ?? null)
                ?? 0;

            $groups[$rate] ??= ['base' => 0, 'tax' => 0];
            $groups[$rate]['base'] += $baseCents;
            $groups[$rate]['tax'] += $taxCents;
        }

        $invoiceTaxCents = $this->centsOrNull($snapshot['tax_amount_cents'] ?? null)
            ?? $this->centsOrNull($snapshot['tax_amount'] ?? null);

        $hasTaxableGroup = false;

        foreach (array_keys($groups) as $rate) {
            if ((float) $rate > 0.0) {
                $hasTaxableGroup = true;
                break;
            }
        }

        if (! $hasTaxableGroup && $invoiceTaxCents !== null && $invoiceTaxCents > 0) {
            $rate = $this->normalizedRate($snapshot['tax_rate_snapshot'] ?? null) ?? '0.00';
            $subtotalCents = $this->centsOrNull($snapshot['subtotal_cents'] ?? null)
                ?? $this->centsOrNull($snapshot['subtotal'] ?? null)
                ?? 0;
            $exemptCents = $this->centsOrNull($snapshot['exempt_amount_cents'] ?? null)
                ?? $this->centsOrNull($snapshot['exempt_amount'] ?? null)
                ?? 0;

            $groups[$rate] ??= ['base' => 0, 'tax' => 0];
            $groups[$rate]['base'] += max(0, $subtotalCents - $exemptCents);
            $groups[$rate]['tax'] = $invoiceTaxCents;
        }

        if ($groups === []) {
            return [];
        }

        uksort($groups, static fn (string $a, string $b): int => (float) $b <=> (float) $a);

        $rows = [];

        foreach ($groups as $rate => $group) {
            $rows[] = $this->taxBreakdownRow($rate, $group['base'], $group['tax'], null, null);
        }

        return $rows;
    }

    /**
     * @return array{rate: string, base_cents: int, tax_cents: int, base: string, tax: string, base_label: string, tax_label: string}
     */
    private function taxBreakdownRow(string $rate, int $baseCents, int $taxCents, mixed $baseLabel, mixed $taxLabel): array
    {
        $isExempt = (float) $rate === 0.0;
        $compactRate = $this->compactRate($rate);

        return [
            'rate' => $rate,
            'base_cents' => $baseCents,
            'tax_cents' => $taxCents,
            'base' => Money::formatCents($baseCents),
            'tax' => Money::formatCents($taxCents),
            'base_label' => $this->stringValue($baseLabel, $isExempt ? 'Exento' : 'Gravado '.$compactRate.' %'),
            'tax_label' => $this->stringValue($taxLabel, $isExempt ? 'Exento' : 'ISV '.$compactRate.' %'),
        ];
    }

    private function normalizedRate(mixed $value): ?string
    {
        if (is_int($value)) {
            $value = (string) $value;
        }

        if (is_float($value) && is_finite($value)) {
            $value = (string) $value;
        }

        if (! is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        if ($trimmed === '' || preg_match('/^\d+(\.\d{1,2})?$/', $trimmed) !== 1) {
            return null;
        }

        try {
            return Money::formatCents(Money::parseCents($trimmed, 'tax_rate'));
        } catch (\Throwable) {
            return null;
        }
    }

    private function compactRate(string $rate): string
    {
        $trimmed = rtrim(rtrim($rate, '0'), '.');

        return $trimmed === '' ? '0' : $trimmed;
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function normalizedPayment(array $snapshot): array
    {
        $selectedPayment = is_array($snapshot['selected_payment'] ?? null) ? $snapshot['selected_payment'] : null;
        $postedPayments = collect(is_array($snapshot['posted_payments'] ?? null) ? $snapshot['posted_payments'] : [])
            ->filter(fn (mixed $payment): bool => is_array($payment))
            ->map(fn (array $payment): array => [
                'method' => $payment['method'] ?? '',
                'amount' => $this->moneyValue($payment['amount_cents'] ?? null, $payment['amount'] ?? null),
                'reference' => $payment['reference'] ?? null,
                'paid_at' => $payment['paid_at'] ?? null,
                'cashier_name' => $payment['cashier_name'] ?? null,
            ])
            ->values()
            ->all();

        return [
            'selected_payment' => $selectedPayment ? [
                'method' => $selectedPayment['method'] ?? '',
                'amount' => $this->moneyValue($selectedPayment['amount_cents'] ?? null, $selectedPayment['amount'] ?? null),
                'reference' => $selectedPayment['reference'] ?? null,
                'paid_at' => $selectedPayment['paid_at'] ?? null,
                'cashier_name' => $selectedPayment['cashier_name'] ?? null,
            ] : null,
            'posted_payments' => $postedPayments,
            'cash_context' => is_array($snapshot['cash_context'] ?? null) ? $snapshot['cash_context'] : [],
            'issued_by' => is_array($snapshot['issued_by'] ?? null) ? $snapshot['issued_by'] : [],
        ];
    }

    /**
     * @param  array<int, mixed>  $snapshot
     * @return list<array<string, mixed>>
     */
    private function normalizedItems(array $snapshot): array
    {
        return array_values(collect($snapshot)
            ->filter(fn (mixed $item): bool => is_array($item))
            ->map(fn (array $item): array => [
                'service_name' => $item['service_name'] ?? '',
                'category_name' => $item['category_name'] ?? null,
                'area_name' => $item['area_name'] ?? null,
                'quantity' => $item['quantity'] ?? '1.00',
                'unit_price' => $this->moneyValue($item['unit_price_cents'] ?? null, $item['unit_price'] ?? null),
                // Price column of a rule-adjusted line: the registered catalogue
                // price (the amount the services table is charged against) so that
                // reference price − authorized adjustment = importe stays true. A
                // line without a proven adjustment keeps the applied price.
                'reference_unit_price' => $this->referenceUnitPrice($item),
                'tax_rate' => $item['tax_rate'] ?? null,
                'tax_amount' => $this->moneyValue($item['tax_amount_cents'] ?? null, $item['tax_amount'] ?? null),
                'line_subtotal' => $this->moneyValue($item['line_subtotal_cents'] ?? null, $item['line_subtotal'] ?? null),
                'line_total' => $this->moneyValue($item['line_total_cents'] ?? null, $item['line_total'] ?? null),
                'adjustment' => $this->lineAdjustmentValue($item),
                'adjustment_unknown' => $this->lineAdjustmentIsUnknown($item),
                // La procedencia del ajuste distingue una gratuidad autorizada
                // de un precio de catálogo legítimamente cero sin copiar al
                // comprobante el código ni el estado técnico de la regla.
                'rule_adjusted' => $this->lineAdjustmentValue($item) !== null
                    || ($item['rule_adjustment_persisted'] ?? null) === false,
                'notes' => $item['notes'] ?? null,
            ])
            ->all());
    }

    /**
     * TRUE only when the snapshot explicitly declares that the per-line rule
     * adjustment was never recorded (`rule_adjustment_persisted = false`, the
     * provenance flag shipped with the line contract). Such a line must print
     * "no registered" instead of `L. 0.00`: a zero would claim a measured
     * adjustment the historical record never had.
     *
     * A snapshot that does not carry the flag at all (older documents) is not
     * declared unknown here; it simply proves no adjustment, which is what the
     * document has always shown.
     *
     * @param  array<string, mixed>  $item
     */
    private function lineAdjustmentIsUnknown(array $item): bool
    {
        return ($item['rule_adjustment_persisted'] ?? null) === false;
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function referenceUnitPrice(array $item): ?string
    {
        $applied = $this->moneyValue($item['unit_price_cents'] ?? null, $item['unit_price'] ?? null);

        $registeredCents = $this->centsOrNull($item['unit_price_registered_cents'] ?? null)
            ?? $this->centsOrNull($item['unit_price_registered'] ?? null);

        if ($registeredCents === null) {
            return $applied;
        }

        if ($this->lineAdjustmentValue($item) === null) {
            return $applied;
        }

        return Money::formatCents($registeredCents);
    }

    /**
     * Authorized adjustment the line snapshot proves, as a money string, or null
     * when it proves none.
     *
     * The compact template prints this in its own "Ajuste autorizado" column.
     * Priority is the value billing already persisted (the rule adjustment of an
     * eligible line), then the registered unit price against the applied one
     * (times the quantity), then the registered line amount against the applied
     * one. A normal line resolves to null, so the document prints an empty cell
     * instead of a fabricated `L. 0.00` discount. Cents arithmetic only.
     *
     * @param  array<string, mixed>  $item
     */
    private function lineAdjustmentValue(array $item): ?string
    {
        // Explicit provenance: the record declares the adjustment was never
        // written, so nothing can be printed as a measured value (not even zero).
        if ($this->lineAdjustmentIsUnknown($item)) {
            return null;
        }

        foreach ([
            'rule_adjustment', 'adjustment_amount', 'discount_amount',
            'rule_adjustment_cents', 'adjustment_amount_cents', 'discount_amount_cents',
        ] as $key) {
            $cents = array_key_exists($key, $item) ? $this->centsOrNull($item[$key]) : null;

            if ($cents !== null && $cents > 0) {
                return Money::formatCents($cents);
            }
        }

        $registeredUnitCents = $this->centsOrNull($item['unit_price_registered_cents'] ?? null)
            ?? $this->centsOrNull($item['unit_price_registered'] ?? null);
        $appliedUnitCents = $this->centsOrNull($item['unit_price_cents'] ?? null)
            ?? $this->centsOrNull($item['unit_price'] ?? null);

        if ($registeredUnitCents !== null && $appliedUnitCents !== null && $registeredUnitCents > $appliedUnitCents) {
            $units = $this->centsOrNull($item['quantity'] ?? null);

            if ($units !== null && $units > 0) {
                return Money::formatCents(intdiv((($registeredUnitCents - $appliedUnitCents) * $units) + 50, 100));
            }
        }

        $registeredLineCents = $this->centsOrNull($item['line_subtotal_cents'] ?? null)
            ?? $this->centsOrNull($item['line_subtotal'] ?? null);
        $appliedLineCents = $this->centsOrNull($item['line_total_cents'] ?? null)
            ?? $this->centsOrNull($item['line_total'] ?? null);

        if ($registeredLineCents !== null && $appliedLineCents !== null && $registeredLineCents > $appliedLineCents) {
            return Money::formatCents($registeredLineCents - $appliedLineCents);
        }

        return null;
    }

    /**
     * Integer cents from a snapshot value, or null when the value is absent or
     * not a well-formed non-negative amount. Quantities use the same two-decimal
     * convention (`1.00` = 100 units), which is what `invoice_items.quantity_cents`
     * stores.
     */
    private function centsOrNull(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_float($value) && is_finite($value)) {
            return (int) round($value);
        }

        if (is_string($value)) {
            $trimmed = trim($value);

            if (preg_match('/^\d+(\.\d{1,2})?$/', $trimmed) === 1) {
                return Money::parseCents($trimmed, 'amount');
            }
        }

        return null;
    }

    private function moneyValue(mixed $cents, mixed $fallback): ?string
    {
        if (is_int($cents)) {
            return Money::formatCents($cents);
        }

        if (is_string($cents) && preg_match('/^-?\d+$/', trim($cents)) === 1) {
            return Money::formatCents((int) trim($cents));
        }

        if (is_float($cents) && is_finite($cents) && floor($cents) === $cents) {
            return Money::formatCents((int) $cents);
        }

        $numeric = $this->numericString($fallback, '');
        if ($numeric === '') {
            return null;
        }

        try {
            return Money::formatCents(Money::parseCents($numeric, 'amount'));
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Detects a lab/validation document by its placeholder fiscal data, so the
     * real downloaded PDF shows the same honest "prueba, sin validez fiscal"
     * notice the engine preview shows. A document with no fiscal data at all is
     * not pretending and gets no notice.
     */
    private function nonFiscalNotice(InstitutionalReceipt $receipt): ?string
    {
        $series = $receipt->series_snapshot;
        $invoice = $receipt->invoice_snapshot;

        $candidates = array_values(array_filter(
            [$series['range_authorization'] ?? null, $invoice['fiscal_cai'] ?? null],
            static fn (mixed $value): bool => is_string($value) && trim($value) !== '',
        ));

        if ($candidates === []) {
            return null;
        }

        $markers = ['VALIDACION', 'VALIDACIÓN', 'PRUEBA', 'DEMO', 'SIN VALIDEZ', 'SIN-VALIDEZ', 'TEST'];

        foreach ($candidates as $value) {
            $upper = mb_strtoupper(trim((string) $value));

            foreach ($markers as $marker) {
                if (str_contains($upper, $marker)) {
                    return 'DOCUMENTO DE PRUEBA - SIN VALIDEZ FISCAL';
                }
            }
        }

        return null;
    }

    private function formatDraftNumber(InstitutionalReceiptSeries $series): string
    {
        return $series->series.'-'.str_pad((string) ($series->current_number + 1), 8, '0', STR_PAD_LEFT);
    }

    private function safeHexColor(mixed $color): string
    {
        $value = is_string($color) ? $color : '';

        return preg_match('/^#[0-9A-Fa-f]{6}$/', $value) === 1 ? $value : '#b91c1c';
    }

    private function safeFontFamily(mixed $fontFamily): string
    {
        $value = is_string($fontFamily) && $fontFamily !== '' ? $fontFamily : 'Arial, sans-serif';

        return preg_match('/^[A-Za-z0-9 ,"\'-]+$/', $value) === 1 ? $value : 'Arial, sans-serif';
    }

    private function amountStatement(mixed $legalText, string $amountWords): string
    {
        $legal = trim(is_string($legalText) ? $legalText : '');

        return trim($legal.' '.$amountWords);
    }

    private function stringValue(mixed $value, string $default = ''): string
    {
        return is_string($value) ? $value : $default;
    }

    private function numericString(mixed $value, string $default): string
    {
        if (is_string($value) && is_numeric($value)) {
            return $value;
        }

        if (is_int($value) || (is_float($value) && is_finite($value))) {
            return (string) $value;
        }

        return $default;
    }

    private function floatValue(mixed $value, float $default): float
    {
        $numeric = $this->numericString($value, '');

        return $numeric === '' ? $default : (float) $numeric;
    }

    private function boolValue(mixed $value, bool $default): bool
    {
        return is_bool($value) ? $value : $default;
    }

    private function logoDataUriForProfile(ReceiptPrintProfile $profile): ?string
    {
        if (! $profile->use_logo || ! Storage::disk('public')->exists('branding/logo.png')) {
            return null;
        }

        $contents = Storage::disk('public')->get('branding/logo.png');

        if (! is_string($contents) || $contents === '') {
            return null;
        }

        $mime = Storage::disk('public')->mimeType('branding/logo.png') ?: 'image/png';

        if (! str_starts_with($mime, 'image/')) {
            $mime = 'image/png';
        }

        return $this->safeImageDataUri('data:'.$mime.';base64,'.base64_encode($contents));
    }

    private function safeImageDataUri(mixed $value): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        return preg_match('/^data:image\/(?:png|jpe?g);base64,[A-Za-z0-9+\/=]+$/', $value) === 1
            ? $value
            : null;
    }

    /**
     * Monochrome logo for thermal paper.
     *
     * A thermal head only prints black/white; a colour logo is dithered into
     * mud. When GD is available the source image is converted to grayscale at the
     * same pixel size (never upscaled, so the effective resolution of the source
     * is preserved) and re-encoded as PNG. If GD is unavailable or the data URI
     * is not a readable raster, the original image is kept instead of inventing
     * a logo.
     */
    private function monochromeLogoDataUri(?string $dataUri): ?string
    {
        if ($dataUri === null || ! function_exists('imagecreatefromstring')) {
            return $dataUri;
        }

        $marker = 'base64,';

        if (preg_match('/^data:image\/(?:png|jpe?g);'.$marker.'/', $dataUri) !== 1) {
            return $dataUri;
        }

        $position = strpos($dataUri, $marker);

        if ($position === false) {
            return $dataUri;
        }

        $encoded = substr($dataUri, $position + strlen($marker));
        $binary = base64_decode($encoded, true);

        if (! is_string($binary) || $binary === '') {
            return $dataUri;
        }

        $image = @imagecreatefromstring($binary);

        if ($image === false) {
            return $dataUri;
        }

        imagefilter($image, IMG_FILTER_GRAYSCALE);

        ob_start();
        imagepng($image);
        $png = ob_get_clean();
        imagedestroy($image);

        if (! is_string($png) || $png === '') {
            return $dataUri;
        }

        return 'data:image/png;base64,'.base64_encode($png);
    }

    private function configString(string $key, string $default): string
    {
        $value = config($key);

        return is_string($value) ? $value : $default;
    }

    private function configFloat(string $key, float $default): float
    {
        $value = config($key);

        if (is_int($value) || is_float($value)) {
            return (float) $value;
        }

        return is_string($value) && is_numeric($value) ? (float) $value : $default;
    }
}
