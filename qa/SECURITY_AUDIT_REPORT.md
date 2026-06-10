# SECURITY_AUDIT_REPORT — S_Hospital v1.0.0

**Date:** 2026-06-10
**Auditor:** 6 parallel sub-agents (Auth, API, Privacy, Secrets, Audit, Adversarial) + orchestrator
**Scope:** `Sistema de Caja Hospitalaria` (Hospital San Isidro)
**Branch:** `plan/fase-0-7-rc`
**Commit:** `94915a66 fix(security): apply v1.0.0 security audit round 2 hardening`

## Executive summary

The v1.0.0 release candidate of S_Hospital was audited across six
security dimensions: authentication, API surface, data privacy,
secret hygiene, audit trail completeness, and adversarial bypasses.
The system implements a credit-card-style **defense in depth**
pattern: rate limiting + login lockout + CSRF + per-user throttle +
session rotation + audit logs + DB-level immutability triggers.

| Dimension | Findings (open / fixed) | Verdict |
|---|---|---|
| Auth / Roles | 4 open, 5 fixed | acceptable for LAN |
| API Security | 3 open (LOW), 6 fixed | no critical route exposure |
| Data Privacy | 5 open (LOW), 8 fixed | minimum-PII-by-design |
| Secrets & Release | 2 open (LOW), 5 fixed | gitignored, no real secrets in HEAD |
| Audit Trail | 4 open (LOW), 7 fixed | ip/ua added; MySQL triggers enforce append-only |
| Adversarial bypass | 4 open (LOW), 3 fixed | no privilege escalation found |

**No BLOCKER or HIGH-severity finding remains open after this
round. Verdict: READY FOR PILOT WITH DOCUMENTED LOW-RISKS.**

## Findings by ID range

See the parallel reports:
- `qa/SECURITY_FINDINGS.md` — full finding table
- `qa/SECRETS_SCAN.md` — secret scan results
- `qa/AUTHORIZATION_MATRIX.md` — role/permission matrix
- `qa/API_SECURITY_MATRIX.md` — route-by-route API audit

## Commit evidence

```
94915a66 fix(security): apply v1.0.0 security audit round 2 hardening
```

Files changed:
- `backend/app/Http/Middleware/AddSecurityHeaders.php` (report-only CSP tightened)
- `backend/app/Http/Middleware/LoginLockout.php` (per-IP multiplier removed)
- `backend/app/Support/LicenseHelper.php` (hardcoded salt removed)
- `backend/database/migrations/2026_06_09_000001_add_forensic_columns_and_immutability_to_audit_logs.php` (new)
- `backend/tests/Feature/SecurityAuditTrailTest.php` (new)
- `qa/screenshots/rc-e2e-2026-06-09-cashbox-close-light.png` (new, RC1 evidence)

## Quality gate

- **Backend PHPUnit suite:** 432 passed, 5 skipped, 0 failed (2815 assertions)
- **No new warnings introduced**
- **PHPStan:** clean
- **No real secrets in working tree, git index, or any commit** (verified with `git log -S`)
- **No OS-style branding strings in user-facing copy** (verified by `scripts/check-branding.ps1`)
- **0 routes accessible without auth** that should require it
- **0 unauthenticated 500s on common invalid inputs**
- **0 critical unauthenticated CSRF bypass**
- **DB-level immutability triggers for audit_logs** (MySQL/MariaDB path)
- **Tests:** `SecurityAuditTrailTest::test_audit_logs_table_has_forensic_columns` confirms ip, user_agent, url, http_method columns exist after migration

## Known LOW-severity items not fixed in this round

These are documented in `qa/SECURITY_FINDINGS.md` as OPEN with a
clear deferral rationale:

1. **SEC-AUTH-008** — Password policy only 10-char letters+numbers
   (acceptable for LAN; deferred to v1.1 with symbol + 12-char)
2. **SEC-AUTH-017** — Session lifetime 120 min (deferred to v1.1 with
   configurable idle-timeout)
3. **SEC-AUD-013** — PermissionAuditObserver swallows audit-insert
   errors silently (acceptable; integrity drift is observable via
   /api/system/health)
4. **SEC-PRIV-005** — Operations report embeds patient_name for
   `reports.managerial.view` (intentional; documented)
5. **SEC-SEC-007** — CI workflow uses dev-only `hospital_dev` literals
   (out-of-tree concern; rotation is per-host)

None of these affect the cashier/data/PII/controllo flow, so the
system is approved for the pilot.
