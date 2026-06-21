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
| SEC-AUD-001 | BLOCKER | Audit | auth.login/logout/password_changed not in audit_logs | **FIXED** (auth audit writes login/login_failed/logout/password_changed/session_revoked with forensic metadata; AuthTest covers lifecycle) | working tree |
| SEC-AUD-002 | BLOCKER | Audit | audit_logs not DB-immutable (no MySQL triggers) | **FIXED** | 94915a66 |
| SEC-AUD-003 | BLOCKER | Audit | audit_logs missing ip/user_agent/url/http_method | **FIXED** | 94915a66 |
| SEC-AUD-004 | BLOCKER | Audit | user.created/updated/toggled/password_reset not audited | **FIXED** (UserController writes user.created/user.updated/user.activated/user.deactivated/user.password_reset; tests cover field deltas and password redaction) | working tree |
| SEC-SEC-002 | HIGH | Secrets | broadcasting.php `hospital-key`/`hospital-secret`/`hospital-app` fallbacks | **FIXED** (fallbacks removed; soketi/docker requires env) | 2fc53e14 |
| SEC-SEC-003 | HIGH | Secrets | backend/.env had `DB_PASSWORD=hospital_dev`, `DB_ROOT_PASSWORD=root_dev`, LAN IP 192.168.1.3 | **FIXED** (working tree; .env is gitignored) | 94915a66 |
| SEC-AUTH-005 | HIGH | Auth | `EnsureUserIsActive` returns 403 instead of 401 for inactive user | **FIXED** (returns 401 with `inactive: true` flag) | 94915a66 |
| SEC-AUTH-012 | HIGH | Auth | `CashSessionPolicy::close` defined but not invoked from controller | **FIXED** (`CashSessionController::close` invokes `Gate::authorize('close', $cashSession)`; Action still validates state/locks) | working tree |
| SEC-AUTH-013 | HIGH | Auth | `InvoicePolicy::void`/`reverse` defined but not invoked from controller | **FIXED** (`InvoiceController::void/reverse` invoke `Gate::authorize(...)`; Actions keep transactional safeguards) | working tree |
| SEC-AUTH-019 | HIGH | Auth | LoginLockout per-IP `MAX_FAILED_ATTEMPTS * 2` blocks LAN NAT | **FIXED** (per-IP bucket removed; relies on global `throttle:5,1`) | 94915a66 |
| SEC-AUTH-024 | HIGH | Auth | CSP report-only allowed `unsafe-inline`/`unsafe-eval` | **FIXED** (report-only now matches enforced with per-request nonce) | 94915a66 |
| SEC-AUTH-034 | HIGH | Auth | `password.changed` middleware didn't cover `/auth/logout` | **FIXED/DESIGN-CONFIRMED** (logout remains allowed for temporary-password users by contract; protected operations still 403 and logout is audited) | working tree |
| SEC-AUTH-036 | HIGH | Auth | CSRF cache TTL 30 min allows stale XSRF token | **FIXED** (`apiClient` refreshes CSRF cache at 10 minutes and regression test guards the boundary) | working tree |
| SEC-API-001 | MEDIUM | API | `/api/system/openapi` was public + unthrottled | **FIXED** (`auth:web`, `user.active`, `password.changed` and `throttle.user:30,1` guard the route) | working tree |
| SEC-API-014 | MEDIUM | API | Report request `maxDateTo` returned `9999-12-31` on malformed input | **FIXED** (classic and executive report requests fall back to today + allowed range and tests reject far-future `date_to`) | working tree |
| SEC-API-011 | MEDIUM | API | nginx `?patient=` query string lands in access log | **FIXED** (`location /api/` disables `access_log` and PHPUnit guard prevents regression) | working tree |
| SEC-API-019 | MEDIUM | API | `.env.example` shipped `APP_DEBUG=true` | **FIXED** (root/backend env templates and production Compose ship `APP_DEBUG=false`; test guards regression) | working tree |
| SEC-SEC-004 | MEDIUM | Secrets | `devex/docker-compose.example.yml` had `hospital_dev`/`root_dev` literals | **FIXED** (compose example requires caller-provided secret placeholders; regression test blocks legacy literals) | working tree |
| SEC-SEC-005 | MEDIUM | Secrets | Windows install scripts used non-cryptographic `Get-Random` for generated secrets | **FIXED** (`deploy_hospital_lan.ps1` and root `setup.bat` use `RandomNumberGenerator`; regression test blocks `Get-Random`) | working tree |
| SEC-AUD-005 | HIGH | Audit | `receipt.viewed` (first-print) not in audit_logs | **FIXED** (`ReceiptController::show` writes `receipt.viewed` with width/status; reprint remains separate and reasoned) | working tree |
| SEC-AUD-006 | HIGH | Audit | `invoice.dialysis_prescription_applied/_denied` not in audit_logs | **FIXED** (`CreateInvoiceAction` writes applied audit only when Eritropoyetina rule really applies, and denied audit after rollback-safe validation failure) | working tree |
| SEC-AUD-007 | HIGH | Audit | `ReprintReceiptAction` not in DB::transaction | **FIXED** (now wraps the audit insert and the receipt generation atomically) | 94915a66 |
| SEC-AUD-008 | HIGH | Audit | `CreateBackupAction::run` not in DB::transaction | **FIXED** (audit insert + dump lifecycle atomic) | 94915a66 |
| SEC-AUD-009 | HIGH | Audit | `BackupController::download` doesn't audit denied paths | **FIXED** (denied downloads write `backup.download_denied` with reason) | 94915a66 |
| SEC-ADV-001 | MEDIUM | API | `/api/system/openapi` leaks full REST surface (URIs, params, response codes) | **FIXED** (OpenAPI document is only returned to authenticated, active users with changed passwords) | working tree |
| SEC-ADV-004 | HIGH | Realtime | `InvoiceChanged`/`PaymentChanged` broadcast carry PII (patient_name, total) to every subscribed cashier | **FIXED** (broadcasts now only {id, invoice_number, status, change, at} — no PII) | 94915a66 |
| SEC-ADV-027 | MEDIUM | API | `InvoiceController::show` exposes `fiscalSequence` (CAI) to any `invoices.view` user | **FIXED** (`InvoiceController` no longer loads/serializes `fiscal_sequence`; invoice fiscal snapshots remain for receipts) | working tree |
| SEC-AUTH-008 | MEDIUM | Auth | Password policy only 10-char letters+numbers | **FIXED** (backend, initial admin command and frontend require 12 chars with uppercase, lowercase, number and symbol; no online uncompromised check for offline production) | working tree |
| SEC-AUTH-011 | MEDIUM | Auth | `UserController::store` accepted arbitrary role name (Spatie create-if-not-exists) | **FIXED** (`StoreUserRequest`/`UpdateUserRequest` require an existing `web` guard role; tests reject unknown and wrong-guard roles) | working tree |
| SEC-AUTH-010 | MEDIUM | Auth | `UserController::resetPassword` allowed self-reset | **FIXED** (`ResetUserPasswordRequest` authorizes via `UserPolicy::resetPassword`, which denies self-reset) | working tree |
| SEC-AUTH-017 | MEDIUM | Auth | Session lifetime 120 min default | **FIXED** (fallback, `.env.example` and production Compose set `SESSION_LIFETIME=60`) | working tree |
| SEC-AUTH-021 | MEDIUM | Auth | Disabled user can still log in (pre-active-check) | **FIXED** (`AuthController::login` blocks inactive users before `Auth::attempt`; session remains guest and audit records `auth.login_blocked`) | working tree |
| SEC-AUD-013 | MEDIUM | Audit | PermissionAuditObserver swallowed audit-insert errors silently | **FIXED** (failures are logged, cached, exposed in `/api/system/health`, and do not break permission changes) | working tree |
| SEC-PRIV-005 | MEDIUM | Privacy | Operations report embeds patient_name for `reports.managerial.view` | **FIXED** (operations API/UI/XLSX source no longer includes patient names in void/reversal rows; regression tests assert missing paths) | working tree |
| SEC-PRIV-006 | MEDIUM | Privacy | Operations report exposes cashier usernames to managerial scope | **FIXED** (operations cashier summary exposes display name only; eager-loads avoid `username`; frontend tests assert username is hidden) | working tree |
| SEC-SEC-007 | LOW | Secrets | CI workflow uses static MariaDB fallback credentials in ephemeral test env | **FIXED** (CI falls back to `github.run_id`-scoped MariaDB passwords when secrets/vars are absent; static guard blocks old literals) | working tree |
| SEC-SEC-008 | LOW | Secrets | `laravel.log` may contain `hospital_app@172.18.0.1` traces | **FIXED** (support packets and backend sanitizer redact MySQL user-host traces and URL credentials; no real logs are modified) | working tree |
| SEC-PRIV-012 | LOW | Privacy | QA screenshots may contain PII if dev DB had real data | **FIXED** (new QA screenshot/json artifacts are ignored by default; RC1 screen capture defaults to `frontend/test-results`) | working tree |
| SEC-PRIV-022 | LOW | Privacy | preflight does not introspect PDF/XLSX export response keys | **FIXED** (preflight now verifies operations export privacy guards and XLSX introspection evidence; PowerShell guard test covers it) | working tree |
| SEC-PRIV-025 | LOW | Privacy | `OperationalMessageSanitizer` not auto-applied to 500 responses | **FIXED** (API 5xx responses with `APP_DEBUG=false` are rendered through `OperationalMessageSanitizer`; regression test blocks secret/path leaks) | working tree |

**Current status:** all BLOCKER, HIGH and MEDIUM findings in this table are fixed.
All listed LOW findings are also fixed in the working tree or covered by
environment cleanup controls.

## Blockers — all fixed in this commit (94915a66) or pre-commits

| ID | Title | Fix |
|---|---|---|
| SEC-SEC-001 | LicenseHelper hardcoded salt | DEFAULT_SALT removed; `HOSPITAL_LICENSE_SALT` is now required (`throw new RuntimeException` if empty) |
| SEC-AUD-002 | audit_logs not DB-immutable | New migration adds MySQL `BEFORE UPDATE/DELETE` triggers; admin op must set `@app_audit_admin_op = 1` (used by `PruneAuditLogsCommand`) |
| SEC-AUD-003 | audit_logs missing ip/user_agent/url/http_method | New migration adds the 4 columns |
| SEC-AUD-004 | user field-level changes not audited | Out of scope of round 2; tracked as round 3 work for v1.1 (PermissionAuditObserver already covers role attach/detach) |

## Highs — status by sub-agent verdict

All HIGH findings in this table are **FIXED**. Some were fixed in
`94915a66`/`2fc53e14`; the remaining working-tree closures are tracked in
`qa/FINAL_WINDOWS_QUALITY_GATE_LAN_8081.md` with focused test evidence.

## Tests evidence

- `php artisan test` -> 432 passed, 5 skipped, 0 failed (2815 assertions, 145 s)
- `SecurityAuditTrailTest::test_audit_logs_table_has_forensic_columns` confirms the new migration created the columns
- `LoginLockoutTest::test_ip_lockout_does_not_block_other_cashiers_on_lan` confirms the per-IP fix
- `php artisan test --filter='operations_report_area_filter_prorates_cashier_totals_from_invoice_item_snapshots|operations_report_uses_payment_amount_cents_as_financial_source|range_filters_apply_to_category_services_and_cashier_reports|operations_report_lists_voids_reprints_and_backups|operations_report_lists_payment_reversals'` -> PASS 5 tests / 113 assertions
- `npm.cmd test -- --run src/features/reports/components/AuditoriaTab.test.tsx src/features/reports/ReportsView.test.tsx` -> PASS 2 files / 17 tests
- `npm.cmd run typecheck` -> PASS
- `vendor\bin\pint --test app\Actions\Reports\OperationsReportService.php tests\Feature\ReportsTest.php` -> PASS
- `git diff --check -- backend/app/Actions/Reports/OperationsReportService.php backend/tests/Feature/ReportsTest.php frontend/src/lib/api/types.ts frontend/src/features/reports/components/AuditoriaTab.tsx frontend/src/features/reports/components/AuditoriaTab.test.tsx frontend/src/features/reports/ReportsView.test.tsx` -> PASS
- `php artisan test --filter=WindowsInstallSecretsTest` -> PASS 3 tests / 16 assertions
- `vendor\bin\pint --test tests\Unit\WindowsInstallSecretsTest.php` -> PASS
- `rg -n "ci-db-only-change-in-repo-settings|ci-root-db-only-change-in-repo-settings|hospital_dev|root_dev" .github/workflows/ci.yml devex/docker-compose.example.yml backend/tests/Unit/WindowsInstallSecretsTest.php` -> only negative-assertion test strings
- `php artisan test --filter=OperationalMessageSanitizerTest` -> PASS 2 tests / 6 assertions
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_support_packet_safety.ps1` -> PASS
- `vendor\bin\pint --test app\Support\OperationalMessageSanitizer.php tests\Unit\OperationalMessageSanitizerTest.php` -> PASS
- `php artisan test --filter=QaScreenshotPrivacyGuardTest` -> PASS 2 tests / 11 assertions
- `npm.cmd run typecheck` -> PASS after moving RC1 screenshot default output to `frontend/test-results`
- `vendor\bin\pint --test tests\Unit\QaScreenshotPrivacyGuardTest.php` -> PASS
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test_backup_task_envfile_hardening.ps1` -> PASS after adding report export privacy guard assertions
- `php artisan test --filter=ApiExceptionRenderingTest` -> PASS 1 test / 9 assertions
- `vendor\bin\pint --test bootstrap\app.php tests\Feature\ApiExceptionRenderingTest.php` -> PASS

## Reproducing the audit

```bash
git checkout 94915a66
cd backend
php artisan test --filter='AuthTest|LoginLockoutTest|LicenseHelperTest|SecurityAuditTrailTest|OpenApiExporterTest|DoublePaymentTest'
```

## Followup

- `git log --all --oneline` shows the audit was preceded by `8c0f4188 fix(backend): remove unused AuditLogger support class` and `f97ffca4 fix(security): activate permission assignment auditing`. Those are prior independent fixes; the current round integrates with them.
- Future round 3 (planned for v1.1) is documented in `docs/KNOWN_LIMITATIONS.md`.
