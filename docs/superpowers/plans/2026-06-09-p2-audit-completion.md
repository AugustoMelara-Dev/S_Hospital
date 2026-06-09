# P2 Audit Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining actionable BUG-P2 audit findings against the updated `origin/main` codebase without reworking fixes that already landed upstream.

**Architecture:** Keep changes surgical and backend-first for correctness: authorization/date semantics, production config, and operational hardening stay in Laravel services, requests, config, and tests. Frontend changes are deferred unless a remaining backend contract requires them.

**Tech Stack:** Laravel 12, PHP 8.2+, PHPUnit, MySQL/MariaDB production semantics, React/Vite only if a phase reaches UI.

---

## Current Baseline

After fast-forwarding `main` to `origin/main` on 2026-06-09, the pasted P2 report is partly stale. These items already exist in the updated code and are not reimplemented in this plan:

- `LoginLockout` middleware and `LoginLockoutTest`.
- `HealthController`, `CspReportController`, `EchoConfigController`.
- `ReverseInvoiceAction`, `InvoiceController::reverse`, `InvoiceReverseTest`.
- `InvoicePolicy`, `CashSessionPolicy`, and policy registration in `AppServiceProvider`.
- `hospital:prune-audit-logs` and `hospital:prune-failed-jobs`.
- Payment cents columns, report guards, and cents-related tests.
- Production CSP nonce enforcement for script/style sources.

Untracked/generated files present before this plan must remain out of commits:

- `backend/build/`
- `qa/AUDIT_FIX_TRACKING.md`

## Phase P2-A: Operational Timezone Hardening

**Scope:**

- Make the hospital operational timezone explicit instead of hardcoded UTC.
- Preserve cashier "own invoice from today" authorization around Honduras local midnight.
- Document the decision.

**Files:**

- Modify: `backend/config/app.php`
- Modify: `backend/.env.example`
- Modify: `backend/tests/Unit/ProductionConfigDefaultsTest.php`
- Modify: `backend/tests/Unit/InvoiceAccessTest.php`
- Modify: `docs/DECISIONS.md`

**Migrations:** none.

**Risks:**

- Tests that assumed UTC may need explicit timestamps.
- Fiscal expiration checks use dates and should remain date-based, not shifted by time.

**Acceptance Criteria:**

- `config/app.php` defaults `app.timezone` to `env('APP_TIMEZONE', 'America/Tegucigalpa')`.
- `.env.example` exposes `APP_TIMEZONE=America/Tegucigalpa`.
- A regression test proves a cashier can operate an invoice issued late at night in Tegucigalpa when UTC has already advanced to the next date.
- Targeted PHPUnit tests pass.

**TDD Steps:**

- [x] Add failing config-default test in `ProductionConfigDefaultsTest` asserting the timezone default.
- [x] Add failing `InvoiceAccessTest` for the Tegucigalpa/UTC day-boundary scenario.
- [x] Run the two tests and verify they fail for the expected reasons.
- [x] Implement the minimal config/env/docs changes.
- [x] Run the two tests again and verify they pass.
- [x] Run related invoice/history/receipt authorization tests.
- [x] Commit: `fix(config): use hospital local timezone`

## Phase P2-B: License Salt Production Fail-Closed

**Scope:**

- Re-audit `LicenseHelper` and `AppServiceProvider` after the upstream fast-forward.
- If a public fallback salt can still validate `license.json` in production, make production fail closed unless `HOSPITAL_LICENSE_SALT` is configured.
- Keep local/testing behavior compatible if existing tests require a default.

**Files:**

- Likely modify: `backend/app/Support/LicenseHelper.php`
- Likely modify: `backend/app/Providers/AppServiceProvider.php`
- Likely modify: `backend/tests/Feature/LicenseHelperTest.php`
- Likely modify: `backend/tests/Unit/ProductionConfigDefaultsTest.php`
- Modify: `docs/DECISIONS.md`

**Migrations:** none.

**Risks:**

- Breaking local validation mode if production-only behavior is not isolated.
- Invalidating existing local registration files when salt is intentionally empty in local/dev.

**Acceptance Criteria:**

- Production with an empty `HOSPITAL_LICENSE_SALT` cannot silently trust the embedded public fallback.
- Local/testing behavior remains documented and covered.
- Tests pass.

**TDD Steps:**

- [x] Inspect current license tests and production config tests.
- [x] Add a failing production-mode test for missing `HOSPITAL_LICENSE_SALT`.
- [x] Run the test and verify the expected failure.
- [x] Implement minimal production-only guard.
- [x] Run license/config tests and verify they pass.
- [x] Commit: `fix(security): require production license salt`

## Phase P2-C: Remaining P2 Reconciliation Audit

**Scope:**

- Re-run code searches against the updated codebase for stale P2 findings.
- Update `qa/AUDIT_FIX_TRACKING.md` or a new tracked QA report only if it is already intended for tracking; otherwise leave generated/untracked evidence alone.
- Convert any remaining confirmed high/critical finding into its own new phase plan before implementation.

**Files:**

- Modify: `docs/DECISIONS.md` if a decision changes.
- Create/modify QA report only if it is not generated scratch evidence.

**Migrations:** none unless a new confirmed finding requires them.

**Acceptance Criteria:**

- Search results distinguish resolved, accepted, and still-open findings.
- No generated coverage files are committed.
- Any new high/critical unresolved item gets its own phase with tests and commit.

**Execution Result:**

- [x] Reconciled findings in `qa/P2_RECONCILIATION_2026_06_09.md`.
- [x] Confirmed no new high/critical unresolved P2 item remains in `HEAD`.
- [x] Kept generated/unrelated worktree files out of P2 commits.

**Verification Commands:**

```powershell
rg -n "ROUND\\(|\\(float\\).*amount|SECRET_SALT|HOSPITAL_LICENSE_SALT|isToday\\(|MustVerifyEmail|unsafe-inline|LoginLockout|PatientInvoiceController|InvoiceAuditController|ReverseInvoiceAction|hospital:prune" backend\app backend\routes backend\tests backend\database docs\DECISIONS.md
git status --short --branch
```

## Plan Review

**Decision:** APROBADO CON CAMBIOS.

**Findings from the required 8-review lens:**

- Arquitectura: avoid reintroducing a broad "fix all P2" commit; confirmed fixes must stay out of this branch.
- Base de datos: timezone phase has no migration and does not touch stored money or fiscal numbers.
- Seguridad: license salt phase may be production-sensitive and must be fail-closed with tests.
- UI/UX: no UI change is needed for timezone unless status display contradicts backend config.
- Rendimiento: no query shape changes in Phase P2-A.
- Offline LAN: `America/Tegucigalpa` matches the deployment geography and keeps cash sessions aligned to the hospital day.
- QA/TDD: each behavior-changing phase starts with a failing test.
- Dominio: cashier permissions depend on the local hospital day, not UTC.

**Checklist de entrada a implementación:**

- [x] Working branch: `codex/p2-audit-completion`.
- [x] Upstream fast-forward applied.
- [x] Generated/untracked evidence identified and excluded from commits.
- [x] Phase P2-A tests written and verified red.
- [x] Phase P2-B tests written and verified red.
- [x] Phase P2-C reconciliation documented.
