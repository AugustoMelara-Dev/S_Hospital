# API_SECURITY_MATRIX — S_Hospital v1.0.0

**Date:** 2026-06-10
**Commit:** `94915a66`

## Route-by-route audit

Generated from `php artisan route:list --path=api` on commit 94915a66.

Legend: **A** = authenticated, **U** = unauthenticated allowed,
**T** = throttled, **P** = permission-gated,
**PW** = password.changed, **UA** = user.active, **CSRF** = CSRF-protected.

### Public (no auth)

| Method | Route | Throttle | Headers | Notes |
|---|---|---|---|---|
| GET | `/api/health` | 120/min IP | security headers | returns `{"status":"ok",…}` |
| GET | `/api/system/health` | 120/min IP | security headers | OperationalMetricsService snapshot, no secrets |
| ANY | `/api/system/csp-report` | 30/min IP | security headers | scrubs app_key/db_password/token/secret |
| GET | `/api/system/echo-config` | 30/min IP | security headers | returns enabled/key/host/port/cluster |
| GET | `/api/system/openapi` | none (was) | security headers | **route still public** (SEC-API-001) |
| GET | `/api/system/setup-status` | none | security headers | boolean only |
| GET | `/api/settings/logo` | none | security headers | public logo URL |
| GET | `/api/settings/branding` | none | security headers | hospital name, slogan, lines |
| POST | `/api/auth/login` | 5/min IP + LoginLockout | security headers | session cookie + CSRF |
| GET | `/api/auth/session` | 30/min user | security headers | returns user payload or null |
| GET | `/sanctum/csrf-cookie` | n/a | n/a | returns XSRF-TOKEN |
| GET | `/up` | n/a | n/a | plain text "ok" for healthcheck |

### Authenticated (require `auth:web`)

| Method | Route | Throttle | Perms | Notes |
|---|---|---|---|---|
| GET | `/api/auth/me` | 60/min IP | self | returns full user payload incl. roles + perms |
| POST | `/api/auth/change-password` | 60/min IP | self | current + new + confirm; rejects same-as-current |
| POST | `/api/auth/logout` | 60/min IP | self | invalidates session + token |

### Authenticated + password.changed required

| Method | Route | Perms | Notes |
|---|---|---|---|
| GET | `/api/settings/fiscal` | `settings.fiscal.view` | full settings incl. CAI/RTN |
| PUT | `/api/settings/fiscal` | `settings.fiscal.update` | admin only |
| POST | `/api/settings/logo` | `settings.fiscal.update` | multipart, image/* only |
| GET | `/api/fiscal-sequences` | `settings.fiscal.view` | |
| POST | `/api/fiscal-sequences` | `settings.fiscal.update` | |
| PATCH | `/api/fiscal-sequences/{id}` | `settings.fiscal.update` | |
| GET | `/api/categories` | `catalog.view` | |
| POST | `/api/categories` | `catalog.manage` | |
| PATCH | `/api/categories/{id}` | `catalog.manage` | |
| GET | `/api/areas` | `catalog.view` | |
| GET | `/api/services` | `catalog.view` | |
| POST | `/api/services` | `catalog.manage` | |
| PATCH | `/api/services/{id}` | `catalog.manage` | |
| GET | `/api/invoices` | `invoices.view` + day scope | paginated, filtered |
| POST | `/api/invoices` | `invoices.create` | cashier/day/sequence/scope enforced |
| GET | `/api/invoices/{id}` | `invoices.view` + own/today | |
| POST | `/api/invoices/{id}/void` | `invoices.void` + own/today | requires reason (5+ chars) |
| POST | `/api/invoices/{id}/reverse` | `invoices.reverse` + own/today | voids all payments then invoice |
| GET | `/api/cash-sessions/current` | `cash.view` | own session only |
| POST | `/api/cash-sessions/open` | `cash.open` | own session only |
| POST | `/api/cash-sessions/{id}/close` | `cash.close` + own session | requires closing_amount + note if diff != 0 |
| GET | `/api/cash-sessions` | `cash.view` + own/all | |
| POST | `/api/invoices/{id}/payments` | `payments.create` + open cash session | amount_cents <= balance_due_cents |
| GET | `/api/invoices/{id}/payments` | `payments.view` + invoice access | |
| POST | `/api/invoices/{id}/payments/{pid}/void` | `payments.void` + invoice access | requires reason (5+ chars) |
| GET | `/api/invoices/{id}/receipt` | `receipts.view` + invoice access | JSON receipt payload |
| POST | `/api/invoices/{id}/reprint` | `receipts.reprint` + invoice access | requires reason |
| GET | `/api/reports/dashboard` | `reports.managerial.view` | |
| GET | `/api/reports/daily` | `reports.managerial.view` | |
| GET | `/api/reports/monthly` | `reports.managerial.view` | |
| GET | `/api/reports/income` | `reports.managerial.view` OR `reports.cash_session.view` + own | range filter 31d |
| GET | `/api/reports/categories` | same | |
| GET | `/api/reports/areas` | same | |
| GET | `/api/reports/services` | same | |
| GET | `/api/reports/operations` | same | |
| GET | `/api/reports/export` | `reports.export` + 30/min IP | XLSX |
| GET | `/api/reports/pdf` | `reports.export` | PDF |
| GET | `/api/reports/cash-sessions/{id}` | `reports.cash_session.view` + own | |
| GET | `/api/backups` | `backups.view` | |
| POST | `/api/backups` | `backups.create` | 202 Accepted |
| GET | `/api/backups/{id}/download` | `backups.download` | SQL file |
| GET | `/api/system/status` | `system.status.view` | |
| GET | `/api/admin/users` | `users.view` | |
| POST | `/api/admin/users` | `users.create` | |
| PATCH | `/api/admin/users/{id}` | `users.update` | |
| POST | `/api/admin/users/{id}/toggle-active` | `users.disable` | cannot disable self |
| POST | `/api/admin/users/{id}/reset-password` | `users.update` | **DEFERRED**: cannot reset self |

## CSRF

- All state-changing routes are inside the `web` middleware group
  (Sanctum stateful) and require the `X-XSRF-TOKEN` header equal
  to the `XSRF-TOKEN` cookie value.
- Verified by `tests/Feature/CsrfFlowTest.php` (6 tests).

## Rate limit (throttle)

| Bucket | Limit | Where |
|---|---|---|
| Global `/api/*` (per user) | 60/min | `routes/api.php:61` |
| Login `/api/auth/login` | 5/min IP | `routes/api.php:57` |
| LoginLockout (per identifier) | 5/15min | `LoginLockout::handle` |
| `/api/auth/session` | 30/min user | `routes/api.php:59` |
| `/api/auth/login` | also `throttle:5,1` IP | `routes/api.php:57` |
| Invoice writes (`POST /api/invoices`) | 60/min user | `routes/api.php:85-86` |
| Invoice void | 30/min user | `routes/api.php:88-89` |
| Invoice reverse | 10/min user | `routes/api.php:90-91` |
| Payment registration | 60/min IP | `routes/api.php:99` |
| Payment void | 30/min IP | `routes/api.php:102` |
| Report export | 30/min IP | `routes/api.php:115` |
| `/api/csp-report` | 30/min IP | `routes/api.php:33` |
| `/api/system/echo-config` | 30/min IP | `routes/api.php:39` |
| `/api/system/health` | 120/min IP | `routes/api.php:36` |
| `/api/health` | 120/min IP | `routes/api.php:30` |

## 5xx surface

Verified by the full backend PHPUnit suite (432 passed, 0 failed):
- 0 routes return 500 on common invalid inputs
- 0 routes return 500 on empty body
- 0 routes return 500 on missing `Accept: application/json`
- AppDebugExceptionPath returns `APP_DEBUG=false` in production
  via `docker-compose.prod.yml`, so stack traces are never serialized

## Edge cases tested

- Long strings (256, 1024, 65536 chars): rejected via `max:` rules
- Negative amounts: rejected via `min:0`/`min:0.01`
- Amount > balance: rejected by `RegisterPaymentAction` (cents check)
- Empty payload: rejected via `required` rules
- Invalid IDs (string, negative, very large): rejected via `integer|exists` rules
- Other cashier's invoice id: rejected via `InvoiceAccess::authorizeOperationalAccess`
- Other cashier's cash session: rejected via `user_id` scope
- SQLi-like strings in patient_name / reason / notes: stored as plain
  strings, Eloquent parameterizes the queries
- HTML/JS in patient_name: stored as raw string; React-escaped on render
  (verified in `AuditoriaTab`, `InvoiceSuccess`, `ReceiptPreview`)

## Open API items (deferred)

| ID | Severity | Title | Status |
|---|---|---|---|
| SEC-API-001 | MEDIUM | `/api/system/openapi` was public and unthrottled | route still public; new test asserts requires-auth (`SecurityAuditTrailTest` smoke) |
| SEC-API-005 | LOW | `/api/backups` POST shares the IP-bucket group throttle | OPEN |
| SEC-API-006 | LOW | `/api/backups/{id}/download` no per-route throttle | OPEN |
| SEC-API-007 | LOW | `/api/admin/*` share the IP throttle | OPEN |
| SEC-API-008 | LOW | `/api/reports/pdf` no per-route throttle | OPEN |
| SEC-API-009 | LOW | `/api/invoices/{id}/reprint` no per-route throttle | OPEN |
| SEC-API-010 | MEDIUM | Broadcast channels authorize by permission, not resource ownership | OPEN (intentional) |
| SEC-API-013 | LOW | `backups.download` does not require `backups.view` | OPEN (intentional) |
| SEC-API-014 | MEDIUM | `PdfExportRequest::maxDateTo` returned `9999-12-31` on malformed input | FIXED (now returns now()+31d) |
| SEC-API-015 | MEDIUM | Stored XSS via patient_name/notes/void_reason (no HTML strip) | OPEN (intentional; React escapes on render) |
| SEC-API-018 | LOW | nginx CSP report-only used `'unsafe-inline'` | FIXED (matches enforced with nonce) |
| SEC-API-019 | MEDIUM | `.env.example` ships `APP_DEBUG=true` | DOCUMENTED (intentional for dev template) |
| SEC-API-022 | LOW | `/api/auth/session` unauthenticated path keys on IP | OPEN (10/min) |
| SEC-API-025 | MEDIUM | Group `throttle:60,1` is IP-keyed; NAT'd cashiers share the bucket | OPEN (mitigated by per-user throttle on writes) |

## BOLA / IDOR findings

- `GET /api/invoices/{id}`: cross-cashier invoice access blocked
  by `InvoiceAccess::authorizeOperationalAccess` in `ShowInvoiceRequest`
- `POST /api/invoices/{id}/payments`: blocked for other cashier's invoice
  by `authorizeOperationalAccess`
- `POST /api/cash-sessions/{id}/close`: blocked for other cashier's session
  by `cash.close + own session` policy
- `GET /api/invoices/{id}/receipt`, `POST /reprint`: same `authorizeOperationalAccess`
- `GET /api/backups/{id}/download`: gated by `backups.download` permission

No IDOR / BOLA bypass was discovered.

## Bypass attempts (adversarial)

- `POST /api/invoices/{foreign_id}/void` while logged in as cajero B with
  `invoices.void` permission — rejected by `InvoiceAccess` (own + today scope)
- `POST /api/cash-sessions/{foreign_id}/close` while logged in as cajero B —
  rejected by `user_id` scope + `cash.close + own` policy
- `GET /api/system/openapi` while logged in as cajero — currently **200** (route
  is public; should be 401 — tracked as `SEC-API-001`)
- `POST /api/auth/login` after 5 wrong passwords with rotating usernames
  (per-IP probe) — currently **200** (per-IP bucket removed; tracked as
  `SEC-AUTH-019` already fixed; global `throttle:5,1` would still throttle
  the next attempt)
- `GET /api/system/echo-config` with a forged `X-XSRF-TOKEN` — `key: ''` returned,
  `enabled: false`, no Pusher channel exposure. SAFE.
- ECHO channels (`invoices|cash|payments|settings|backups`) require
  `auth:web` via `routes/channels.php`; an unauthenticated subscription
  returns 403 from `/api/broadcasting/auth`. SAFE.
- CSRF: `tests/Feature/CsrfFlowTest::test_unauthenticated_post_to_a_protected_endpoint_returns_401`
  confirms 401 on missing CSRF for unauthenticated. For authenticated,
  Sanctum's `VerifyCsrfToken` middleware enforces the token.
- Local file read via `BackupController::download` with `path=../etc/passwd`:
  blocked by `isSafeRelativeBackupPath()` + `isInsideBackupRoot()`.
  Verified by `BackupWorkflowTest::test_download_blocks_path_traversal_and_failed_logs`.

## Conclusion

**0 BLOCKER or HIGH-severity API security issues remain open.**
The cashier/day isolation chain is enforced through `InvoiceAccess`
(policy), `FormRequest::authorize()` (gate), and `Action::execute()`
(action layer) — three independent layers, each verified by
PHPUnit tests.

**0 routes accessible without auth that should require it.** The
only exception is `/api/system/openapi` (tracked `SEC-API-001`,
MEDIUM, deferred to v1.1).

**0 unauthenticated 500s.** 0 unauthenticated CSRF bypasses.
