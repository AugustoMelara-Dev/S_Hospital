<?php

/**
 * Institutional receipt printing keys (C2-B7).
 *
 * These keys only describe HOW a receipt document is composed on paper. They do
 * not select a paper profile, a copy set or a destination for an installation:
 * that configuration lives in `receipt_print_profiles` (per workstation, resolved
 * by ResolveReceiptPrintProfileAction) and is snapshotted into every issued
 * receipt, so a historical document never changes because of a config default.
 */
return [

    /*
    |--------------------------------------------------------------------------
    | Two destinations on ONE sheet ("dos ejemplares sobre carta")
    |--------------------------------------------------------------------------
    |
    | When a profile declares exactly two destinations AND the paper is tall
    | enough, the compact template composes the two destinations as two stacked
    | half-sheet zones on a single sheet (patient on top, hospital archive below,
    | with a cut line) instead of one page per destination.
    |
    | The fit is never assumed: `InstitutionalReceiptHtmlBuilder` renders the
    | candidate sheet with the real Dompdf engine and only keeps the two-zone
    | composition when the engine puts it on exactly ONE page. When it does not
    | fit, the document falls back to one legible page per destination, so no
    | line is ever hidden to force a single sheet.
    |
    | `min_paper_height_mm` is the shortest sheet the two zones can be stacked on
    | (a media carta sheet, 139.7 mm, is deliberately excluded: it already is a
    | half sheet, so it keeps one page per destination).
    */
    'two_zone_sheet' => [
        'enabled' => (bool) env('INSTITUTIONAL_RECEIPT_TWO_ZONE_SHEET', true),
        'min_paper_height_mm' => (float) env('INSTITUTIONAL_RECEIPT_TWO_ZONE_MIN_HEIGHT_MM', 250.0),
    ],

    /*
    |--------------------------------------------------------------------------
    | Destinations printed on the two-zone sheet
    |--------------------------------------------------------------------------
    |
    | Labels for the stacked zones. They describe the destination of each
    | copy (who keeps it) so the two exemplars of the same document are
    | distinguishable; they are not an assertion of any archive obligation.
    */
    'destinations' => [
        'patient' => env('INSTITUTIONAL_RECEIPT_PATIENT_COPY_LABEL', 'Ejemplar del paciente'),
        'archive' => env('INSTITUTIONAL_RECEIPT_ARCHIVE_COPY_LABEL', 'Ejemplar para archivo del hospital'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Cut line
    |--------------------------------------------------------------------------
    |
    | Printed between the two zones of the same sheet. It is a cutting aid, not a
    | validity mark, and it never replaces a fiscal or institutional seal.
    */
    'cut_line_label' => env('INSTITUTIONAL_RECEIPT_CUT_LINE_LABEL', 'Línea de corte'),

    /*
    |--------------------------------------------------------------------------
    | Amount whose value is missing
    |--------------------------------------------------------------------------
    |
    | Text used when a historical line has no recorded rule adjustment
    | (`rule_adjustment_persisted = false`). A missing datum is never rendered as
    | `L. 0.00`, which would claim a measured zero that the record never had.
    */
    'unknown_adjustment_label' => env('INSTITUTIONAL_RECEIPT_UNKNOWN_ADJUSTMENT_LABEL', 'No registrado'),

    /*
    |--------------------------------------------------------------------------
    | Legitimate zero
    |--------------------------------------------------------------------------
    |
    | A receipt whose amount is zero is a gratuity/without-charge document. It
    | must never reuse the "haber enterado ... la suma de" wording, because that
    | would claim cash was received. This is the replacement sentence.
    */
    'without_charge_notice' => env(
        'INSTITUTIONAL_RECEIPT_WITHOUT_CHARGE_NOTICE',
        'Documento sin cobro: no se recibió efectivo.'
    ),

];
