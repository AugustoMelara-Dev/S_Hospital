# Known limitations safety evidence - 2026-06-03

Decision: `PASSED`.

Scope:

- Verify that `docs\KNOWN_LIMITATIONS.md` does not keep already-guarded
  operational safeguards as pending work.
- Confirm that real final-field blockers remain visible before
  `PRODUCTION_READY`.
- Confirm that the barcode/report SQL extension stays isolated under
  `database\_reference_DO_NOT_EXECUTE\` instead of an executable database root
  path.
- Confirm that CSP report handling is backed by controller and feature-test
  evidence.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_known_limitations_safety.ps1
```

Observed result:

- `KNOWN_LIMITATIONS_SAFETY: YES`.
- `KNOWN_LIMITATIONS.md` no longer lists legacy installer deprecation, robust
  IP detection, barcode/report SQL relocation or CSP report channel as pending
  v1.1 work.
- The same document records those items as closed with evidence references.
- Final blockers remain visible: second-client LAN validation, physical
  printer proof, final restore, final concurrency, backup worker tasks,
  `SistemaCajaHospitalaria-StackAutostart` and final handoff.
- `database\schema_extensions_for_barcode_reports.sql` is absent from the
  executable database root, while the reference file remains under
  `database\_reference_DO_NOT_EXECUTE\`.
- LAN recovery evidence and `scripts\lib\net_diagnostics.ps1` confirm
  `Get-NetRoute` and route-metric based IP selection.
- `backend\tests\Feature\CspReportControllerTest.php` covers
  `/api/system/csp-report` and its rate limit, and
  `backend\app\Http\Controllers\CspReportController.php` logs reports for
  support.

Safety notes:

- This guard is read-only.
- It does not start services, migrate, seed, restore data, print receipts,
  read `.env` or touch Docker volumes.
- It does not replace final-server LAN, printer, backup task, restore,
  concurrency or production preflight proof.
