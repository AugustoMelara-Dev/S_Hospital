# V1.1 Institutional Receipt PDF Digital Proof

Status: digital proof passed
Date: 2026-06-25
Branch: `codex/v1-1-production-polish`
Scope: backend institutional receipt PDF generation and API behavior with synthetic test data.

This proof does not approve physical printing. It only records digital PDF/HTML behavior verified by automated tests.

## Command

```powershell
cd C:\Projects\S_Hospital-v1-1-polish
docker run --rm -v ${PWD}:/workspace -v s_hospital-v1-1-polish_backend_vendor:/workspace/backend/vendor -w /workspace/backend s_hospital-v1-1-polish-backend php artisan test --filter=InstitutionalReceiptPdfTest --display-warnings --colors=never
```

## Result

- Exit code: 0.
- Test class: `Tests\Feature\InstitutionalReceiptPdfTest`.
- Tests: 13.
- Assertions: 171.
- Warnings: 13 environment warnings from missing `/workspace/backend/.env` in the Docker test mount.
- Duration: 13.48s on the detailed warning run.

## Coverage Confirmed

- Institutional receipt HTML includes configured institution, series, invoice, patient, cashier/payment context, services, totals, amount in words, copy labels, and signature sections.
- Receipt HTML escapes patient, service, notes, and payment reference values.
- Receipt HTML and PDF paths cover many-item receipts with 100 service lines and long descriptions.
- Real PDF bytes start with `%PDF` for half letter, letter, A5, 80mm, and 58mm profiles.
- PDF generation does not mutate receipt number, series snapshots, or series current number.
- Draft/test print includes `PRUEBA - SIN VALIDEZ` and does not reserve a receipt number.
- Logo rendering is gated by the receipt print profile.
- CSS context settings are sanitized.
- PDF endpoint requires receipt access permission.
- Other-cashier receipt PDF access is forbidden.
- Reprint PDF requires a reason after the first print and records reprint audit events.
- Reprint PDF with idempotency header streams PDF bytes instead of replaying JSON.
- Test-print endpoint streams draft PDF, records a test event, and keeps the series number unchanged.
- Main receipt output is verified to avoid QR, barcode, and raw internal snapshot field names in the covered paths.

## Warning Assessment

The warnings are caused by `file_get_contents(/workspace/backend/.env): Failed to open stream: No such file or directory` during the Docker-mounted test run. The test base then forces the testing environment in `Tests\TestCase::forceTestingEnvironment()`. This is consistent with the broader backend Docker suite evidence and did not fail assertions.

## Limitations

- This is not a hardware printer proof.
- This does not validate browser print dialog settings.
- This does not validate signed or photographed printed samples.
- This does not approve go-live physical production.
- Physical approval still requires the final cashier computer, real printer or exact printer configuration, and completion of `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`.
