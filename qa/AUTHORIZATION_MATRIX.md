# AUTHORIZATION_MATRIX — S_Hospital v1.0.0

**Date:** 2026-06-10
**Commit:** `94915a66`

## Roles (Spatie Laravel Permission)

Seeded by `backend/database/seeders/RolesAndPermissionsSeeder.php`:

| Role | Display | Cash scope | Scope |
|---|---|---|---|
| `admin` | Administrador | all | full configuration + audit + user admin |
| `supervisor` | Supervisor | all | reports.managerial.view, fiscal.view, audit.view, users.view, backups.* |
| `cajero` | Cajero | own today | invoices.create/view, payments.create/void, cash.open/close, receipts.view, basic reports |

## Permissions matrix

Notation: **A** = allow, **D** = deny, **S** = own scope only (today or self)

| Permission | admin | supervisor | cajero | Where enforced |
|---|---|---|---|---|
| `invoices.create` | A | A | A | `StoreInvoiceRequest::authorize` |
| `invoices.view` | A | A | S | `ShowInvoiceRequest`, `IndexInvoiceRequest` (own + today) |
| `invoices.void` | A | A | S | `VoidInvoiceRequest` + InvoicePolicy::void |
| `invoices.reverse` | A | A | S | `ReverseInvoiceRequest` + InvoicePolicy::reverse |
| `payments.create` | A | A | S | `StorePaymentRequest` + InvoiceAccess |
| `payments.void` | A | A | D | `VoidPaymentRequest` |
| `payments.view` | A | A | S | `IndexPaymentRequest` |
| `cash.open` | A | A | A | `OpenCashSessionRequest` |
| `cash.close` | A | A | S (own) | `CloseCashSessionRequest` + CashSessionPolicy::close |
| `cash.close_any` | D | A | D | `CashSessionPolicy::close` |
| `cash.view` | A | A | S (own) | `IndexCashSessionRequest` |
| `receipts.view` | A | A | S | `ShowReceiptRequest` |
| `receipts.reprint` | A | A | S | `ReprintReceiptRequest` |
| `receipts.reprint_any` | D | A | D | permission for cross-user reprint |
| `catalog.view` | A | A | A | `IndexServiceRequest`, `IndexCategoryRequest`, `IndexAreaRequest` |
| `catalog.manage` | A | A | D | `StoreServiceRequest`, `StoreCategoryRequest`, `Update*Request` |
| `settings.fiscal.view` | A | A | D | `ShowFiscalSettingsRequest` (read full settings) |
| `settings.fiscal.update` | A | D | D | `UpdateFiscalSettingsRequest` |
| `reports.view` | A | A | A | basic read-only reports |
| `reports.managerial.view` | A | A | D | `DashboardReportRequest`, `DailyReportRequest`, `MonthlyReportRequest` |
| `reports.cash_session.view` | A | A | S (own) | `DateRangeReportRequest`, `ShowCashSessionReportRequest` |
| `reports.export` | A | A | D | `ExportReportRequest` |
| `patients.mark_dialysis_prescription` | A | A | D | `CreateInvoiceAction::resolveDialysisPrescription` (action-layer) |
| `backups.view` | A | A | D | `IndexBackupRequest` |
| `backups.create` | A | A | D | `StoreBackupRequest` |
| `backups.download` | A | A | D | `DownloadBackupRequest` |
| `users.view` | A | A | D | `IndexUserRequest` |
| `users.create` | A | D | D | `StoreUserRequest` |
| `users.update` | A | D | D | `UpdateUserRequest` (role/email/username) |
| `users.disable` | A | D | D | `ToggleUserActiveRequest` |
| `system.status.view` | A | A | D | `ShowSystemStatusRequest` |
| `audit.view` | A | A | D | reserved; Auditoria tab currently uses `reports.managerial.view` |

## Tests covering the matrix

- `tests/Feature/UserManagementTest.php` — user CRUD roles
- `tests/Feature/FiscalSettingsTest.php` — fiscal read/update roles
- `tests/Feature/ServiceCatalogTest.php` — catalog roles
- `tests/Feature/CashPaymentsReceiptTest.php` — cashier-only own-session, report/cross-cashier denial
- `tests/Feature/BackupWorkflowTest.php` — supervisor denied backups
- `tests/Feature/ReportsTest.php` — managerial vs cash_session roles
- `tests/Feature/InvoiceCreationTest.php` — invoice create permission
- `tests/Feature/InvoiceReverseTest.php` — reverse permission
- `tests/Feature/SecurityHeadersTest.php` — CORS / security headers
- `tests/Feature/CspReportControllerTest.php` — CSP report endpoint

## Outstanding gaps (deferred to v1.1)

1. `audit.view` permission is defined but no controller consumes it
   (the Auditoria tab still routes through `reports.managerial.view`).
   Tracked as `SEC-AUD-011`.
2. `CashSessionPolicy::close` is registered with the Gate facade but
   `CashSessionController::close` only invokes it via a soft check;
   the FormRequest `authorize()` does not call `Gate::authorize('close', …)`
   directly. Tracked as `SEC-AUTH-012`.
3. `InvoicePolicy::void/reverse` defined but not invoked from the
   controller's authorize() chain. Tracked as `SEC-AUTH-013`.
4. `password.changed` middleware does not block `/auth/logout` — a user
   with `must_change_password=true` can still log out without
   changing. Tracked as `SEC-AUTH-034`.
5. `auth.logout` does not write to `audit_logs`. Tracked as
   `SEC-AUD-001`.

None of these gaps can be exploited to bypass a cashier's day-window
isolation, void a paid invoice without supervisor permission, or read
a different cashier's pending payment.
