# Role and Module Operational Audit - 2026-05-19

Status: approved for controlled local demo after automated gates.

## Scope

Audit goal: verify that the main hospital billing modules are reachable only by the intended roles and that the operational data connects across invoice, payment, cash, receipt, reports, and backups.

Roles covered:

- admin
- supervisor
- cajero

Modules covered:

- Login/session
- Dashboard/navigation
- New invoice/POS
- Cash box
- Catalog
- Invoice history/reprint/void
- Reports
- Fiscal settings
- Backups

## Role Matrix

| Module | Admin | Supervisor | Cajero | Evidence |
|---|---:|---:|---:|---|
| Login/session | Allowed | Allowed | Allowed | `AuthTest` |
| Dashboard/navigation | Allowed | Allowed | Allowed with role scope | `App.test.tsx`, Playwright e2e |
| POS invoice creation | Allowed | Allowed | Allowed | `InvoiceCreationTest`, `App.test.tsx`, Playwright e2e |
| Payment registration | Allowed | Allowed | Allowed with own/current operational scope | `CashPaymentsReceiptTest`, `ReportsTest`, Playwright e2e |
| Cash box | Allowed | Allowed | Allowed with own cash scope | `CashPaymentsReceiptTest`, `ReportsTest`, `App.test.tsx` |
| Catalog view | Allowed | Allowed | Allowed read-only | `ServiceCatalogTest`, `App.test.tsx` |
| Catalog manage | Allowed | Configurable by permission | Denied | `ServiceCatalogTest` |
| Invoice history/reprint | Allowed | Allowed | Limited by operational scope | `InvoiceHistoryReprintVoidTest`, `App.test.tsx`, Playwright e2e |
| Invoice void | Allowed | Allowed | Denied | `InvoiceHistoryReprintVoidTest`, `App.test.tsx` |
| Reports managerial | Allowed | Allowed | Denied unless specific cash-session permission | `ReportsTest`, `App.test.tsx` |
| Fiscal settings view | Allowed | Allowed | Denied | `FiscalSettingsTest` |
| Fiscal settings update | Allowed | Denied | Denied | `FiscalSettingsTest` |
| Backups list/create/download | Allowed | Denied | Denied | `BackupWorkflowTest`, `App.test.tsx`, Playwright e2e |

## Cross-Module Accounting Checks

| Check | Expected Result | Evidence |
|---|---|---|
| Paid invoice remains discoverable from POS success/history | Invoice can be opened from success flow and searched by invoice number | `App.test.tsx`, commit `b659ba6` |
| Payment is associated with invoice and cash session | No orphan payment in normal payment flow | `CashPaymentsReceiptTest`, operational DB diagnosis from PR #5 |
| Cash report totals match posted payments | Cash session report totals include payment method totals and expected cash | `ReportsTest` |
| Reports use backend aggregates/export | CSV export is protected backend endpoint, not frontend-only math | `ReportsTest`, `App.test.tsx` |
| Backup events are visible only to backup permission holders | Backup metadata hidden from users without backup permission | `ReportsTest`, `BackupWorkflowTest` |

## Backup Automation

- Manual backup: admin-only UI/API through `backups.view`, `backups.create`, `backups.download`.
- Automatic backup: Laravel scheduler runs `hospital:backup --type=scheduled` daily.
- Default time: `02:00`.
- Override: `HOSPITAL_DAILY_BACKUP_TIME=HH:MM`.
- Windows production options:
  - Schedule `php artisan schedule:run` every minute.
  - Or run `scripts/install_backup_tasks_windows.ps1` to register direct daily backup and worker tasks.

## Gate Evidence

- `php artisan test --colors=never`: passed, 138 tests / 802 assertions.
- `vendor/bin/pint --test`: passed.
- `php artisan config:cache --no-ansi`: passed.
- `php artisan config:clear --no-ansi`: passed.
- `php artisan schedule:list --no-ansi`: shows `0 2 * * * php artisan hospital:backup --type=scheduled`.
- `npm.cmd run test`: passed, 30 tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed with known large chunk warning.
- `npm.cmd run e2e`: passed, 2 tests. First run hit a transient service-search timeout; immediate rerun passed without code changes.
- `npm.cmd run smoke:real` against `http://192.168.1.7:8000`: passed, 1 non-mutating real navigation test; mutation test intentionally skipped without `E2E_REAL_ALLOW_MUTATIONS=1`.
- Real scheduled backup command: passed after detecting XAMPP dump binary. Created `hospital-backup-20260519-143246-t2tcamra.sql`, status `success`, size `299891`, SHA256 `4633427ffb79efec03b97fd98997d2d367d809580e4816d90040b44da1c3c49b`.
- Windows wrapper backup command: passed. `scripts/run_scheduled_backup.cmd` created `hospital-backup-20260519-144322-ys8wi5a9.sql`.

## Remaining Field Validation

- Physical LAN client access from a second device still needs to be tested on the final server IP.
- Physical thermal printer 80mm/58mm still needs real hardware evidence before claiming `PRODUCTION_READY`.
- Windows scheduled task management requires an elevated PowerShell session on this machine. Non-elevated attempts can run the backup wrapper but cannot reliably create/start/query the scheduled tasks.
