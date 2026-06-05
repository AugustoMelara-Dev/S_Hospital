# Browser smoke evidence validation - 2026-06-05

Decision: `PASS`.

Scope:

- Regenerate mocked browser evidence for dashboard, cashbox, new invoice, receipt previews, reports and backups against the current RC branch tip.
- Verify light and dark captures include critical operator states without console issues.
- Keep the warning that mocked browser evidence does not replace final LAN, MySQL/MariaDB or physical printer validation.

Command run:

```powershell
$env:E2E_CAPTURE_RC_SCREENSHOTS='1'
$env:E2E_CAPTURE_RC_OUTPUT_DIR='..\qa\browser-smoke-2026-06-05'
$env:E2E_CAPTURE_RC_REPORT_DIR='qa/browser-smoke-2026-06-05'
npx.cmd playwright test production-readiness.spec.ts
```

Observed result:

- Playwright reported both `production-readiness.spec.ts` tests as OK and wrote `qa\browser-smoke-2026-06-05\rc-e2e-mocked-report.json`.
- The shell command timed out after screenshots were written, so the clean executable gate remains the regular non-capture Playwright run plus `scripts\validate_browser_smoke_evidence.ps1`.
- The JSON report records `mode: mocked-e2e`, `console_issues: []` and the explicit note that captures do not replace LAN, MySQL/MariaDB or physical printer proof.
- Screenshots were captured for dashboard light/dark, cashbox open, new invoice empty/cart, receipt media carta/carta/A5/dark, reports and backups.

Safety notes:

- No `.env` file was edited, deleted or committed.
- No database reset, migration, seed, restore or production backup command was executed.
- No physical LAN or printer evidence was invented.
- Final readiness still requires real second-client LAN proof and physical institutional receipt print proof on installed hardware.
