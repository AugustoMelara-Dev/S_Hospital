# Final RC1 Production Handoff (2026-06-09)

## Verdict

**NOT READY** — the lazy-loading frontend test is failing and the
working tree is dirty with an uncommitted fix to
`scripts/refresh_lan_ip.ps1`, even though both items are documented
as PILOT_SAFE / DEFERRED in `docs/KNOWN_LIMITATIONS.md` and the rest
of the quality gate is green. The orchestrator must either (a)
commit the uncommitted helper refactor and accept the documented
lazy-test deferral, or (b) re-introduce the six-view `React.lazy`
split from `main` (commit `130b0cf1`) before declaring pilot-ready.
No new blocker was introduced by this round; the gate reproduces
the pre-existing state.

## Quality gate results

| Check | Status | Evidence | Last lines / note |
|---|---|---|---|
| backend phpunit | **PASS** | `qa/qa-test.txt` (53 768 B, 4 102 lines captured) | `Tests: 4 skipped, 410 passed (2702 assertions)`, `Duration: 183.44s`, exit 0. The 4 skipped are `CriticalModulesCoverageTest` — coverage driver not enabled (pre-existing, opt-in per `KNOWN_LIMITATIONS.md`). |
| backend pint | **PASS** | `qa/qa-pint.txt` (53 B) | `{"tool":"pint","result":"passed"}`, exit 0. |
| backend phpstan | **DEFERRED** | `qa/qa-phpstan.txt` (561 B) | `File 'C:\Projects\S_Hospital\backend/vendor/larastan/larastan/extension.neon' is missing or is not readable.` Documented as DEFERRED in `KNOWN_LIMITATIONS.md` (env gap, pre-existing). |
| frontend typecheck | **PASS** | `qa/qa-typecheck.txt` (75 B) | `tsc --noEmit` clean, exit 0. |
| frontend lint | **PASS** (warnings only) | `qa/qa-lint.txt` (5 840 B) | `0 errors, 28 warnings` (jsx-a11y label associations on `FiscalSettingsView.tsx:439,450`, exhaustive-deps on `ReportsView.tsx:84` and `FiscalSettingsView.tsx:103`, redundant `role=list` on `Sidebar.tsx:79`, plus 24 others). Lint exit 0. |
| frontend vitest | **FAIL** | `qa/qa-fe-test.txt` (1 606 B) + `qa/qa-fe-test-verbose.txt` (44 693 B) + `qa/frontend-test-failure.txt` | `Test Files  1 failed \| 52 passed (53)`, `Tests  1 failed \| 238 passed (239)`, exit 1. **Failed test:** `src/AppRoutes.lazy.test.ts > AppRoutes lazy-loading > defines the heavy views through React.lazy`. Only `AboutView` is reported as missing in the failure message because the test breaks on the first miss; verification by direct regex over `AppRoutes.tsx` confirms 8 of 9 expected-lazy views are eager (`AboutView, BackupsView, CatalogView, FiscalSettingsView, HelpView, InvoiceHistoryView, ReportsView, UsersView`), only `DashboardView` is lazy. Documented as DEFERRED in `KNOWN_LIMITATIONS.md` § "Lazy-loading incompleto en `AppRoutes` — DEFERRED". Pre-existing on this branch — commit `088232ec fix(frontend): keep dashboard as the only lazy route` reduced the lazy set; the test in `acbaf989` was never updated. The `main` branch (commit `130b0cf1 v1.0.0.1 - code split`) does include the six-view refactor, but it is not present on `plan/fase-0-7-rc`. |
| frontend build | **PASS** | `qa/qa-fe-build.txt` (2 204 B) | `✓ built in 12.22s`. 8 chunks emitted; `index-Btsssrp0.js` is 613.11 kB (171.36 kB gzip) and `charts-B2hSYf8O.js` is 396.24 kB — exceeds the 500 kB warning threshold for the entry chunk but is a soft warning, not an error. Exit 0. |
| branding check | **PASS** | `qa/qa-branding.txt` (67 B) | `Revision de branding completada sin hallazgos.`, exit 0. |
| secret scan | **PASS** (0 real credentials) | `qa/qa-secretscan.txt` (771 B) + `qa/secret-scan.txt` | 55 regex hits across 9 patterns, **all benign** — verified by manual review: documentation, test fixtures, expected-error strings, env-key references, the `pre-commit-guard` test cases, and dev seeder placeholders. No committed `.env`, no `BEGIN RSA`, no `sk_live_`/`pk_live_`, no AWS keys. The pre-commit guard (`scripts/pre-commit-guard.ps1` + `backend/tests/PowerShell/pre-commit-guard.tests.ps1`) actively blocks new real credentials. |
| .gitignore hygiene | **PASS w/ LOW note** | `qa/qa-gitignore.txt` (1 192 B) | `.env`, `backend/.env`, `backend/vendor/`, `backend/storage/logs/`, `frontend/dist/`, `offline-release/` are all gitignored. `git ls-files` finds **no** `.env`, no `vendor/`, no `dist/`, no `offline-release/` tracked. Two **non-secret** template files slipped through and are tracked: `backend/storage/framework/testing-production-proofs/qa/LAN_CLIENT_VALIDATION_PROOF.md` (filled operator proof) and `backend/storage/framework/testing-production-proofs-partial/qa/LAN_CLIENT_VALIDATION_PROOF.md` (empty template). The gitignore only blocks `-empty/`, `-missing-evidence/` variants but **not** `-partial/`. Content is benign markdown — no credentials, no session data. Flagged as a residual risk for a future cleanup commit. |

## Bugs fixed in this round

QA is a read-only role; **no source code was modified by this report**.

The orchestrator should be aware that the working tree contains an
uncommitted fix to `scripts/refresh_lan_ip.ps1` from a previous
subagent (migration from `_lib_env_helpers.ps1` /
`_lib_lan_ip.ps1` to `lib/env_helpers.ps1` /
`lib/net_diagnostics.ps1`; this matches the
`BUG-OPS-02` remediation referenced in
`docs/PLAN_7_FASES.md:25`). It is uncommitted on the working
tree and **must be committed** before the pilot handoff. Evidence:
`git status` shows `M scripts/refresh_lan_ip.ps1` and the diff
was inspected (not pasted here for brevity).

## Bugs found but NOT fixed (with rationale)

1. **`AppRoutes.lazy.test.ts` failing** — pre-existing, classified
   as DEFERRED in `docs/KNOWN_LIMITATIONS.md` § "Lazy-loading
   incompleto en `AppRoutes` — DEFERRED". The orchestrator's
   pre-flight review has accepted the risk for pilot. We do not
   edit source code from QA; the choice between (a) honouring the
   deferral or (b) re-applying the `main` branch's six-view
   `React.lazy` refactor (commit `130b0cf1`) is the
   orchestrator's. I am obligated to surface the failure honestly.
2. **`.gitignore` missing `testing-production-proofs-partial/`**
   — LOW. The two files that slipped through are operator
   validation templates with no secrets. Trivial to add one
   line to `.gitignore` (`backend/storage/framework/testing-production-proofs-partial/`)
   and `git rm --cached` the two files, but again QA does not
   modify code. Flagged as a residual risk.
3. **Frontend `index` chunk > 500 kB warning** — informational
   from Vite. The bundle is functional and gzip is 171 kB; the
   `main` branch's `manualChunks` (commit `130b0cf1`) is not
   present on this branch, which is why the entry chunk is
   larger. Not a blocker.
4. **28 ESLint warnings (0 errors)** — `jsx-a11y` label
   associations, exhaustive-deps, and one redundant `role=list`.
   Pre-existing, scheduled for v1.1 in `KNOWN_LIMITATIONS.md`
   ("ESLint warnings a error").

## Blockers

- **None newly introduced by this round.**
- **One pre-existing failure that the orchestrator has previously
  classified as DEFERRED** is still present and reproduced by this
  gate: `frontend/src/AppRoutes.lazy.test.ts > defines the heavy
  views through React.lazy` (vitest exit 1). If the orchestrator
  chooses to re-classify it as a true blocker, the fix path is
  documented: re-apply the six-view `React.lazy` split from
  `130b0cf1` (v1.0.0.1) on `main` and update the test's
  `heavyRoutes` allow-list to match.

## Deferrals (PILOT_SAFE per KNOWN_LIMITATIONS.md)

From `docs/KNOWN_LIMITATIONS.md` § "Issues diferidos a v1.0.0+1
(2026-06-09 round)":

- Lazy-loading incompleto en `AppRoutes` — **DEFERRED** (reproduced).
- `phpstan analyse` not runnable in dev — **DEFERRED** (reproduced).
- `offline-release/` regenerado y no commiteado — **PILOT_SAFE** (confirmed clean from `git ls-files`).
- Tests de eritropoyetina actualizados al flag de top-level — **PILOT_SAFE** (covered by `CalculateInvoiceTotalsActionTest` and `InvoiceCreationTest` updates in commit `8fe44203`).

From v1.0.0 core deferrals (lines 25-54):

- NewInvoiceView refactor (~490 → <200 lines) — DEFERRED v1.1.
- Cobertura > 80% — opt-in only via `--with-coverage`.
- Auditoria de cambios de permisos — Spatie Activitylog installed, listener pending.
- Rate limit por usuario — middleware `ThrottleByUser` pending.
- Health dashboard admin — Recharts UI pending.
- Stack auto-start en reboot — Windows task pending.
- `hospital:maintenance` command — pending.
- IP detection robusta (Get-NetRoute) — placeholder `192.168.1.100` removal pending.
- `schema_extensions_for_barcode_reports.sql` reference to non-existent `source_hash` column — pending.
- ESLint warnings → error — pending.
- CSP report channel — pending.
- LAN client validation física — pending (FASE G).
- Impresora física media carta/carta/A5/80mm/58mm — pending (FASE G).
- Restore real final — pending (FASE G).
- Concurrencia final doble sesión/factura/pago — pending (FASE G).
- Worker continuo de backups (SistemaCajaHospitalaria-BackupWorker / -DailyBackup) — pending (FASE G).
- Handoff final: `scripts/final_production_handoff.ps1` exit 0 sin `-AllowMissingPhysicalProof` — pending (FASE G).

## Risks residual

- **HIGH** — `AppRoutes` lazy-loading split is not present on this
  branch while the contract test still asserts it is. Reproduced
  in `npm run test`. The cashier SPA will still load (build OK,
  typecheck OK, runtime works), but the chunk-size profile is
  larger than the v1.0.0.1 target on `main` and the test contract
  is broken. If the orchestrator accepts the pre-existing
  `KNOWN_LIMITATIONS.md` deferral, this risk is **MEDIUM** for
  pilot (UX-equivalent at the cost of larger initial JS payload).
- **MEDIUM** — Working tree dirty: `scripts/refresh_lan_ip.ps1`
  is modified but uncommitted. If the pilot installer runs from
  the current HEAD commit (not the working tree), the LAN-IP
  refresh will continue to fail on PowerShell 5.1 hosts because
  the old `_lib_env_helpers.ps1` and `_lib_lan_ip.ps1` are
  absent. The orchestrator MUST commit this fix before pilot or
  document why it is not needed.
- **MEDIUM** — `phpstan` is not runnable in this environment
  (larastan missing). Static analysis gate is the rc.3 baseline
  only. Acceptable for pilot per the documented deferral.
- **LOW** — `.gitignore` does not exclude
  `backend/storage/framework/testing-production-proofs-partial/`,
  leaving two benign operator-proof markdown templates tracked.
  No secret content, but the framework dir should ideally be
  wholesale ignored. One-line fix on a future cleanup commit.
- **LOW** — 28 ESLint warnings (jsx-a11y, exhaustive-deps,
  redundant role). Lint exit is 0 so this does not block, but
  the project tracks promotion to error in v1.1.
- **LOW** — Vite warns that `index-Btsssrp0.js` is 613 kB
  (>500 kB threshold). Production UX is fine; the `main`
  branch has `manualChunks` (commit `130b0cf1`) that is not
  present here. Cosmetic.
- **LOW** — `Coverage driver is not enabled (install pcov or
  xdebug in php.ini)` skips `CriticalModulesCoverageTest`. The
  4 skipped tests are pre-existing and PILOT_SAFE.

## Commits

`git log --oneline -15` from `plan/fase-0-7-rc` @ `9fb62cd9`:

```
9fb62cd9 docs: align CHANGELOG, add L.25 cashier flow, register P3 deferrals
312ad0a8 fix(nginx): report-only CSP without placeholder nonce
68224669 feat(frontend): money centralization, session-cleanup, payment cap, echo reset
8fe44203 feat(backend): Money value object, secure dialysis flag, no session-mutation on payment
cdf6840c chore(security): harden secrets and remove default credentials
3711cf1d fix(ci): portable Select-String fallback for branding checks
c431d5dd docs(qa): record cross-session partial review
142b0aaa fix(cash): reconcile cross-session partial payments
ae1ed5ca docs(qa): reconcile p2 audit findings
cfe6df1c fix(security): require production license salt
7474db13 fix(config): use hospital local timezone
9ed5b39e Merge pull request #4 from AugustoMelara-Dev/codex/production-readiness-preflight
f02ab06a merge(main): resolve production readiness preflight conflicts
96cdce38 Merge pull request #10 from AugustoMelara-Dev/codex/audit-f1-config-hardening
088232ec fix(frontend): keep dashboard as the only lazy route
```

## Files modified

`git diff --stat codex/p2-audit-completion..HEAD`:

```
 CHANGELOG.md                                       | 202 +++++++++++
 backend/.env.docker.example                        |  10 +
 backend/app/Actions/Billing/CalculateInvoiceTotalsAction.php |  36 +-
 backend/app/Actions/Billing/CreateInvoiceAction.php          |  36 +-
 backend/app/Actions/Cash/BuildCashReconciliationAction.php   |  13 +-
 backend/app/Actions/Cash/CloseCashSessionAction.php          |  16 -
 backend/app/Actions/Payments/RegisterPaymentAction.php       |   1 -
 backend/app/Http/Requests/Billing/StoreInvoiceRequest.php    |   2 +-
 backend/app/Support/Money.php                                | 111 ++++++
 backend/database/seeders/RolesAndPermissionsSeeder.php       |   1 +
 backend/docker/entrypoint.sh                                 |  19 +-
 backend/tests/Feature/Billing/InvoiceDialysisPrescriptionTest.php | 178 +++++++++
 backend/tests/Feature/Cash/CloseCashSessionTest.php          | 118 ++++++
 backend/tests/Feature/CashPaymentsReceiptTest.php            |   8 +-
 backend/tests/Feature/InvoiceCreationTest.php                |  11 +-
 backend/tests/Feature/Payments/RegisterPaymentDoesNotMutateInvoiceTest.php | 170 +++++++++
 backend/tests/Unit/CalculateInvoiceTotalsActionTest.php      |  30 +-
 backend/tests/Unit/Support/MoneyTest.php                     | 154 ++++++++
 docker-compose.prod.yml                                      |  12 +-
 docs/KNOWN_LIMITATIONS.md                                    |  65 ++++
 docs/OPERATIVE_NOTES_2026_06_02.md                           | 116 ++++++
 docs/PLAN_7_FASES.md                                         | 402 +++++++++++++++++++++
 docs/manuales/MANUAL_CAJERO.md                               |  76 ++++
 frontend/playwright.config.ts                                |  66 ++--
 frontend/src/app/useHospitalSession.test.tsx                 |  51 ++-
 frontend/src/app/useHospitalSession.ts                       |  33 +-
 frontend/src/features/cash/CashBoxView.tsx                   |  25 +-
 frontend/src/features/invoices/NewInvoiceView.test.tsx       |   7 +-
 frontend/src/features/invoices/components/PaymentModal.test.tsx |  52 ++-
 frontend/src/features/invoices/components/PaymentModal.tsx   |  61 +++-
 frontend/src/features/invoices/state/posMath.ts              |  86 ++++-
 frontend/src/lib/api/base.ts                                 |  37 ++
 frontend/src/lib/csrf.ts                                     |  22 ++
 frontend/src/lib/money.ts                                    |  73 ++++
 frontend/src/lib/realtime/echo.test.ts                       |  92 +++++
 frontend/src/lib/realtime/echo.ts                            |  23 +-
 frontend/src/test/money.test.ts                              |  66 ++++
 frontend/src/test/useHospitalSession.test.ts                 |  60 +++
 nginx/default.conf                                           |  58 ++-
 scripts/check-branding.ps1                                   | 108 +++++-
 40 files changed, 2527 insertions(+), 180 deletions(-)
```

## Evidence index (all under `qa/`)

- `qa/qa-test.txt` — full phpunit output (53 768 B)
- `qa/qa-pint.txt` — pint --test
- `qa/qa-phpstan.txt` — phpstan deferral
- `qa/qa-typecheck.txt` — tsc --noEmit
- `qa/qa-lint.txt` — eslint (0 errors, 28 warnings)
- `qa/qa-fe-test.txt` — vitest summary (last 10 lines)
- `qa/qa-fe-test-verbose.txt` — vitest verbose full output (44 693 B)
- `qa/frontend-test-failure.txt` — copy of the verbose output for diff review
- `qa/qa-fe-build.txt` — vite build (12.22s, 8 chunks)
- `qa/qa-branding.txt` — branding check
- `qa/qa-secretscan.txt` — ripgrep secret scan (55 hits, all benign)
- `qa/secret-scan.txt` — UTF-8 copy of the secret scan
- `qa/qa-gitignore.txt` — gitignore + tracked-leak audit
- `qa/qa-commits.txt` — commit inventory and diff stat

Tooling detected: `php` at `C:\xampp\php\php.exe`, `npm` /
`npx.cmd` at `C:\Program Files\nodejs\`, `pnpm` at
`C:\Users\melar\AppData\Local\pnpm\bin\pnpm.ps1`, `git` at
`C:\Program Files\Git\cmd\git.exe`, `rg` at
`C:\Program Files\cursor\resources\app\node_modules\@vscode\ripgrep\bin\rg.exe`.
No tool fallback was needed.
