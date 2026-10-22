# Progress - Backend Codebase & Business Logic Survey

- **Status**: Investigation completed; Analysis and Handoff prepared.
- **Last visited**: 2026-09-28T04:14:00Z
- **Completed Steps**:
  1. Surveyed Laravel architecture, routes, controllers, FormRequests, policies, and DB transaction patterns.
  2. Verified monetary calculation rules, integer cent representation, and per-line evaluation of the EPO dialysis prescription rule (`ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`).
  3. Inspected cashbox, session concurrency guards, initial float, payment method aggregations, and difference handling during closing/arqueo.
  4. Analyzed cancellation (`VoidInvoiceAction` vs `ReverseInvoiceAction`) and mandatory human reprint reason enforcement (`ReprintReason`).
  5. Examined document generation: DomPDF 3.1 for Executive Report (R5) and Institutional Receipt (R6) with official dimensions (Carta 612x792 pt, Media Carta 612x396 pt, A4/A5, no barcodes/QRs) and PhpSpreadsheet for Excel export (5 required sheets, numeric values, formula injection prevention).
  6. Verified backend test suites via local PHP CLI (`MixedDialysisBasketTest`, `InvoicePreviewContractTest`, `PdfFailureDoesNotRechargeTest`, `CloseCashSessionDifferenceTest`, `InstitutionalReceiptPortraitProfileTest`, `ExecutiveExcelExportTest`, `ExecutivePdfExportTest`), passing 100%.
  7. Compiled full survey report into `analysis.md`.
