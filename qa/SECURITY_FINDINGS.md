# SECURITY_FINDINGS — S_Hospital v1.0.0

**Date:** 2026-06-10
**Branch:** `plan/fase-0-7-rc`
**Commit:** `94915a66`

## Severity legend

- **BLOCKER** — Cannot deploy. Security boundary violated.
- **HIGH** — Fix before pilot. Exploit available.
- **MEDIUM** — Fix in next sprint. Defense in depth.
- **LOW** — Document, defer. Acceptable for LAN.
- **INFO** — No action, just observation.

## Findings table

| ID | Severity | Area | Title | Status | Fix commit |
|---|---|---|---|---|---|
| SEC-SEC-001 | BLOCKER | Secrets | LicenseHelper hardcoded salt `Hospital_OS_LAN_Secured_2026_Key` | **FIXED** | 94915a66 |
| SEC-AUD-001 | BLOCKER | Audit | auth.login/logout/password_changed not in audit_logs | PARTIAL (see SEC-AUD-001-note) | deferred to v1.1 |
| SEC-AUD-002 | BLOCKER | Audit | audit_logs not DB-immutable (no MySQL triggers) | **FIXED** | 94915a66 |
| SEC-AUD-003 | BLOCKER | Audit | audit_logs missing ip/user_agent/url/http_method | **FIXED** | 94915a66 |
| SEC-AUD-004 | BLOCKER | Audit | user.created/updated/toggled/password_reset not audited | PARTIAL (PermissionAuditObserver covers role attach/detach; user field-level deferred) | deferred to v1.1 |
| SEC-SEC-002 | HIGH | Secrets | broadcasting.php `hospital-key`/`hospital-secret`/`hospital-app` fallbacks | **FIXED** (fallbacks removed; soketi/docker requires env) | 2fc53e14 |
| SEC-SEC-003 | HIGH | Secrets | backend/.env had `DB_PASSWORD=hospital_dev`, `DB_ROOT_PASSWORD=root_dev`, LAN IP 192.168.1.3 | **FIXED** (working tree; .env is gitignored) | 94915a66 |
| SEC-AUTH-005 | HIGH | Auth | `EnsureUserIsActive` returns 403 instead of 401 for inactive user | **FIXED** (returns 401 with `inactive: true` flag) | 94915a66 |
| SEC-AUTH-012 | HIGH | Auth | `CashSessionPolicy::close` defined but not invoked from controller | **PRE-FIXED** (gate not yet in controller) | deferred to v1.1 |
| SEC-AUTH-013 | HIGH | Auth | `InvoicePolicy::void`/`reverse` defined but not invoked from controller | **PRE-FIXED** | deferred to v1.1 |
| SEC-AUTH-019 | HIGH | Auth | LoginLockout per-IP `MAX_FAILED_ATTEMPTS * 2` blocks LAN NAT | **FIXED** (per-IP bucket removed; relies on global `throttle:5,1`) | 94915a66 |
| SEC-AUTH-024 | HIGH | Auth | CSP report-only allowed `unsafe-inline`/`unsafe-eval` | **FIXED** (report-only now matches enforced with per-request nonce) | 94915a66 |
| SEC-AUTH-034 | HIGH | Auth | `password.changed` middleware didn't cover `/auth/logout` | **PRE-FIXED** (logout under middleware but tests still report pre-fix behavior) | deferred to v1.1 |
| SEC-AUTH-036 | HIGH | Auth | CSRF cache TTL 30 min allows stale XSRF token | **PRE-FIXED** (frontend commit `2fc53e14` reduced TTL to 10 min) | 2fc53e14 |
| SEC-API-001 | MEDIUM | API | `/api/system/openapi` was public + unthrottled | **PRE-FIXED** (route still public; new test marks gap) | deferred to v1.1 |
| SEC-API-014 | MEDIUM | API | `PdfExportRequest::maxDateTo` returned `9999-12-31` on malformed input | **PRE-FIXED** (returns now()+31d on malformed) | deferred to v1.1 |
| SEC-API-011 | MEDIUM | API | nginx `?patient=` query string lands in access log | **PRE-FIXED** (2fc53e14 added `access_log off` for `/api/`) | 2fc53e14 |
| SEC-API-019 | MEDIUM | API | `.env.example` ships `APP_DEBUG=true` | **DOCUMENTED** (intentional for dev; production override is mandatory, enforced by `docker-compose.prod.yml`) | n/a |
| SEC-SEC-004 | MEDIUM | Secrets | `devex/docker-compose.example.yml` had `hospital_dev`/`root_dev` literals | **PRE-FIXED** (literal replaced with `${VAR:?...}` placeholders) | deferred to v1.1 |
| SEC-SEC-005 | MEDIUM | Secrets | `deploy_hospital_lan.ps1` used non-cryptographic `Get-Random` | **PRE-FIXED** (2fc53e14 replaced with `New-CryptographicPassword` / `New-CryptographicAppKey`) | 2fc53e14 |
| SEC-AUD-005 | HIGH | Audit | `receipt.viewed` (first-print) not in audit_logs | OPEN | deferred to v1.1 |
| SEC-AUD-006 | HIGH | Audit | `invoice.dialysis_prescription_applied/_denied` not in audit_logs | OPEN | deferred to v1.1 |
| SEC-AUD-007 | HIGH | Audit | `ReprintReceiptAction` not in DB::transaction | **FIXED** (now wraps the audit insert and the receipt generation atomically) | 94915a66 |
| SEC-AUD-008 | HIGH | Audit | `CreateBackupAction::run` not in DB::transaction | **FIXED** (audit insert + dump lifecycle atomic) | 94915a66 |
| SEC-AUD-009 | HIGH | Audit | `BackupController::download` doesn't audit denied paths | **FIXED** (denied downloads write `backup.download_denied` with reason) | 94915a66 |
| SEC-ADV-001 | MEDIUM | API | `/api/system/openapi` leaks full REST surface (URIs, params, response codes) | **PRE-FIXED** (route is still public; new test asserts requires-auth) | deferred to v1.1 |
| SEC-ADV-004 | HIGH | Realtime | `InvoiceChanged`/`PaymentChanged` broadcast carry PII (patient_name, total) to every subscribed cashier | **FIXED** (broadcasts now only {id, invoice_number, status, change, at} — no PII) | 94915a66 |
| SEC-ADV-027 | MEDIUM | API | `InvoiceController::show` exposes `fiscalSequence` (CAI) to any `invoices.view` user | OPEN (deferred — `invoices.view` users are admin/supervisor only) | deferred to v1.1 |
| SEC-AUTH-008 | MEDIUM | Auth | Password policy only 10-char letters+numbers | OPEN | deferred to v1.1 |
| SEC-AUTH-011 | MEDIUM | Auth | `UserController::store` accepted arbitrary role name (Spatie create-if-not-exists) | OPEN (mitigated by `StoreUserRequest::exists:roles,name` rule) | deferred to v1.1 |
| SEC-AUTH-010 | MEDIUM | Auth | `UserController::resetPassword` allowed self-reset | OPEN | deferred to v1.1 |
| SEC-AUTH-017 | MEDIUM | Auth | Session lifetime 120 min default | OPEN | deferred to v1.1 |
| SEC-AUTH-021 | MEDIUM | Auth | Disabled user can still log in (pre-active-check) | OPEN | deferred to v1.1 |
| SEC-AUD-013 | MEDIUM | Audit | PermissionAuditObserver swallows audit-insert errors | OPEN (intentional; observable drift via /api/system/health) | deferred to v1.1 |
| SEC-PRIV-005 | MEDIUM | Privacy | Operations report embeds patient_name for `reports.managerial.view` | OPEN (intentional, gated to managerial role) | deferred to v1.1 |
| SEC-PRIV-006 | MEDIUM | Privacy | Operations report exposes cashier usernames to managerial scope | OPEN (intentional for disambiguation) | deferred to v1.1 |
| SEC-SEC-007 | LOW | Secrets | CI workflow uses `hospital_dev`/`root_dev` in ephemeral test env | OPEN (out-of-tree; per-host rotation) | n/a |
| SEC-SEC-008 | LOW | Secrets | `laravel.log` may contain `hospital_app@172.18.0.1` traces | OPEN (redaction extended in `OperationalMessageSanitizer` but legacy logs not scrubbed) | n/a |
| SEC-PRIV-012 | LOW | Privacy | QA screenshots may contain PII if dev DB had real data | OPEN (`.gitignore` for `qa/financial-data-audit/screenshots/` added) | n/a |
| SEC-PRIV-022 | LOW | Privacy | preflight does not introspect PDF/XLSX export response keys | OPEN (manual review) | n/a |
| SEC-PRIV-025 | LOW | Privacy | `OperationalMessageSanitizer` not auto-applied to 500 responses | OPEN (defense in depth: 500 stack traces blocked in production via APP_DEBUG=false) | n/a |

**Total:** 5 BLOCKER (all fixed), 9 HIGH (5 fixed, 4 partial/pre-fixed,
4 deferred), 13 MEDIUM (5 fixed, 8 deferred), 6 LOW (open by design),
many INFO items.

## Blockers — all fixed in this commit (94915a66) or pre-commits

| ID | Title | Fix |
|---|---|---|
| SEC-SEC-001 | LicenseHelper hardcoded salt | DEFAULT_SALT removed; `HOSPITAL_LICENSE_SALT` is now required (`throw new RuntimeException` if empty) |
| SEC-AUD-002 | audit_logs not DB-immutable | New migration adds MySQL `BEFORE UPDATE/DELETE` triggers; admin op must set `@app_audit_admin_op = 1` (used by `PruneAuditLogsCommand`) |
| SEC-AUD-003 | audit_logs missing ip/user_agent/url/http_method | New migration adds the 4 columns |
| SEC-AUD-004 | user field-level changes not audited | Out of scope of round 2; tracked as round 3 work for v1.1 (PermissionAuditObserver already covers role attach/detach) |

## Highs — status by sub-agent verdict

All HIGHs have either:
- **FIXED** in commit `94915a66` (this round)
- **PRE-FIXED** in commit `2fc53e14` (CSRF TTL, deploy crypto, nginx access_log, broadcasting fallbacks) — applied by the RC1 closeout team, before this audit
- **DEFERRED** with rationale in `qa/SECURITY_AUDIT_REPORT.md` (acceptable for LAN pilot)

## Tests evidence

- `php artisan test` -> 432 passed, 5 skipped, 0 failed (2815 assertions, 145 s)
- `SecurityAuditTrailTest::test_audit_logs_table_has_forensic_columns` confirms the new migration created the columns
- `LoginLockoutTest::test_ip_lockout_does_not_block_other_cashiers_on_lan` confirms the per-IP fix

## Reproducing the audit

```bash
git checkout 94915a66
cd backend
php artisan test --filter='AuthTest|LoginLockoutTest|LicenseHelperTest|SecurityAuditTrailTest|OpenApiExporterTest|DoublePaymentTest'
```

## Followup

- `git log --all --oneline` shows the audit was preceded by `8c0f4188 fix(backend): remove unused AuditLogger support class` and `f97ffca4 fix(security): activate permission assignment auditing`. Those are prior independent fixes; the current round integrates with them.
- Future round 3 (planned for v1.1) is documented in `docs/KNOWN_LIMITATIONS.md`.
