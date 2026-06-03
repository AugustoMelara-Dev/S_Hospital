# Browser smoke evidence validation - 2026-06-03

Decision: `PASS`.

Scope:

- Verify that the RC browser smoke report references screenshots for dashboard, cashbox, new invoice, receipt previews, reports and backups.
- Verify that Help/support screenshots exist in light and dark mode and keep safe support-evidence flags.
- Verify that console issue arrays are empty and that mocked browser evidence is not presented as a substitute for physical LAN or printer proof.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_browser_smoke_evidence.ps1
```

Observed result:

- `BROWSER_SMOKE_EVIDENCE: YES`.
- All required screenshots referenced by `qa\browser-smoke-2026-06-03\rc-e2e-mocked-report.json` exist and are non-empty.
- `qa\screenshots\rc-help-support-2026-05-31\help-support-report.json` records light and dark Help/support captures with no console issues and no leaked secret words.
- The RC smoke report states that mocked captures do not replace LAN, MariaDB or physical printer validation.

Safety notes:

- This was a read-only evidence guard.
- No browser automation, backend mutation, `.env`, database, backup SQL or production data was changed.
- Final readiness still requires real second-client LAN proof and physical receipt print proof on installed hardware.
