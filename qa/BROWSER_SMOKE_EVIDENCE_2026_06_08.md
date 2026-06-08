# Browser smoke evidence validation - 2026-06-08

Decision: `PASS`.

Scope:

- Regenerate controlled browser evidence for dashboard, cashbox, new invoice, institutional receipts, reports, backups and paid services for area users against the current RC branch tip.
- Verify the Nueva factura flow explains the erythropoietin dialysis prescription rule clearly in the service list and cart.
- Verify reports, backups, area paid services and institutional receipts still include light/dark evidence where applicable and the report records no console issues.
- Keep the warning that controlled browser evidence does not replace final LAN, MySQL/MariaDB or physical printer validation.

Command run:

```powershell
$env:PLAYWRIGHT_EXTERNAL_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5173'
$env:E2E_CAPTURE_RC_SCREENSHOTS='1'
$env:E2E_CAPTURE_RC_OUTPUT_DIR='../qa/browser-smoke-2026-06-08'
$env:E2E_CAPTURE_RC_REPORT_DIR='qa/browser-smoke-2026-06-08'
npm.cmd run e2e -- production-readiness.spec.ts
```

Observed result:

- Playwright reported both `production-readiness.spec.ts` tests as OK and wrote `qa/browser-smoke-2026-06-08/controlled-e2e-report.json`.
- The JSON report records `mode: controlled-e2e`, `console_issues: []` and the explicit note that captures do not replace LAN, MySQL/MariaDB or physical printer proof.
- Screenshots were captured for dashboard light/dark, cashbox open, new invoice empty/cart, institutional receipt media carta/carta/A5/dark, reports light/dark, backups and area paid services light/dark.
- Visual review of `qa/browser-smoke-2026-06-08/billing-new-cart-light.png` confirmed the cart now says `Marcar receta de diálisis: total L. 0.00`, includes guidance to use it only when the patient presents a dialysis prescription, and keeps total L. 25.00 until the checkbox is applied.
- Visual review of `qa/browser-smoke-2026-06-08/institutional-receipt-dark.png` confirmed the receipt stays white in dark mode and does not show QR, barcode, internal catalog identifiers or invented fiscal data.
- Visual review of `qa/browser-smoke-2026-06-08/backups-pending-light.png` confirmed the normal backup screen keeps operator-facing status language and physical validation blockers visible.
- Visual review of `qa/browser-smoke-2026-06-08/area-services-light.png` and `qa/browser-smoke-2026-06-08/area-services-dark.png` confirmed the area user sees paid services for their assigned area, does not see the administrative Reports module, and the table avoids internal technical identifiers.

Safety notes:

- No `.env` file was edited, deleted or committed.
- No database reset, migration, seed, restore or production backup command was executed.
- No physical LAN or printer evidence was invented.
- Final readiness still requires real second-client LAN proof, physical institutional receipt print proof, final-server startup proof and backup automation proof on installed hardware.
