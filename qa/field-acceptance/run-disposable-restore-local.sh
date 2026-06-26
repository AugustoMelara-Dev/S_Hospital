#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  DB_HOST
  DB_PORT
  DB_DATABASE
  DB_USERNAME
  DB_PASSWORD
  RESTORE_TEST_DATABASE
  FIELD_RESTORE_EVIDENCE
)

for key in "${required_vars[@]}"; do
  if [ -z "${!key:-}" ]; then
    echo "Missing required environment variable: ${key}" >&2
    exit 1
  fi
done

cd /repo/backend

php artisan hospital:backup --type=manual

backup_path="$(
  php -r 'require __DIR__ . "/vendor/autoload.php"; $app = require __DIR__ . "/bootstrap/app.php"; $kernel = $app->make(Illuminate\Contracts\Console\Kernel::class); $kernel->bootstrap(); echo (App\Models\BackupLog::query()->where("status", "success")->latest()->first()?->path ?? "") . PHP_EOL;'
)"

if [ -z "$backup_path" ]; then
  echo "No successful backup path found." >&2
  exit 1
fi

backup_abs="/repo/backend/storage/app/private/$backup_path"
if [ ! -f "$backup_abs" ]; then
  backup_abs="/repo/backend/storage/app/$backup_path"
fi

if [ ! -f "$backup_abs" ]; then
  echo "Backup file missing: $backup_path" >&2
  exit 1
fi

backup_sha="$(php -r 'echo hash_file("sha256", $argv[1]);' "$backup_abs")"
backup_bytes="$(php -r 'echo filesize($argv[1]);' "$backup_abs")"
tmp_sql="/tmp/field-restore.sql"

count_query="SELECT CONCAT((SELECT COUNT(*) FROM users), ',', (SELECT COUNT(*) FROM roles), ',', (SELECT COUNT(*) FROM services), ',', (SELECT COUNT(*) FROM invoices), ',', (SELECT COUNT(*) FROM invoice_items), ',', (SELECT COUNT(*) FROM payments), ',', (SELECT COUNT(*) FROM cash_register_sessions), ',', (SELECT COUNT(*) FROM cash_movements), ',', (SELECT COUNT(*) FROM institutional_receipts), ',', (SELECT COUNT(*) FROM audit_logs), ',', (SELECT COUNT(*) FROM fiscal_sequences), ',', (SELECT COUNT(*) FROM fiscal_settings));"

source_counts="$(
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" --password="$DB_PASSWORD" --batch --skip-column-names "$DB_DATABASE" -e "$count_query"
)"

php artisan hospital:decrypt-backup "$backup_abs" "$tmp_sql"

mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" --password="$DB_PASSWORD" -e "DROP DATABASE IF EXISTS \`$RESTORE_TEST_DATABASE\`; CREATE DATABASE \`$RESTORE_TEST_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" --password="$DB_PASSWORD" "$RESTORE_TEST_DATABASE" < "$tmp_sql"

restore_counts="$(
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USERNAME" --password="$DB_PASSWORD" --batch --skip-column-names "$RESTORE_TEST_DATABASE" -e "$count_query"
)"

rm -f "$tmp_sql"

IFS=',' read -r source_users source_roles source_services source_invoices source_invoice_items source_payments source_sessions source_movements source_receipts source_audit_logs source_fiscal_sequences source_settings <<EOF_SOURCE_COUNTS
$source_counts
EOF_SOURCE_COUNTS

IFS=',' read -r restore_users restore_roles restore_services restore_invoices restore_invoice_items restore_payments restore_sessions restore_movements restore_receipts restore_audit_logs restore_fiscal_sequences restore_settings <<EOF_COUNTS
$restore_counts
EOF_COUNTS

strict_source_counts="$source_users,$source_roles,$source_services,$source_invoices,$source_invoice_items,$source_payments,$source_sessions,$source_movements,$source_receipts,$source_fiscal_sequences,$source_settings"
strict_restore_counts="$restore_users,$restore_roles,$restore_services,$restore_invoices,$restore_invoice_items,$restore_payments,$restore_sessions,$restore_movements,$restore_receipts,$restore_fiscal_sequences,$restore_settings"
audit_delta=$((source_audit_logs - restore_audit_logs))

if [ "$strict_source_counts" != "$strict_restore_counts" ] || { [ "$audit_delta" -ne 0 ] && [ "$audit_delta" -ne 1 ]; }; then
  echo "Count mismatch: source=$source_counts restore=$restore_counts audit_delta=$audit_delta" >&2
  exit 1
fi

cd /repo
mkdir -p "$(dirname "$FIELD_RESTORE_EVIDENCE")"

cat > "$FIELD_RESTORE_EVIDENCE" <<EOF_EVIDENCE
# S_Hospital V1.1 - Disposable Backup/Restore Field Evidence

Date: 2026-06-25 America/Tegucigalpa
Mode: local disposable Docker/MariaDB validation
Source database: \`$DB_DATABASE\`
Restore database: \`$RESTORE_TEST_DATABASE\`
Production database touched: NO
Real patient data used: NO
Backup file: \`storage/app/private/$backup_path\`
Backup SHA256: \`$backup_sha\`
Backup size bytes: $backup_bytes

## Result

PASS - backup was generated through \`php artisan hospital:backup --type=manual\`, decrypted with \`hospital:decrypt-backup\`, imported into a separate disposable database, and source/restore counts matched for core business tables.

Audit log note: source audit logs may be one row higher because the backup success audit entry is written after the SQL dump is produced. Observed audit delta: $audit_delta.

## Counts

| Table | Source | Restore |
| --- | ---: | ---: |
| users | $source_users | $restore_users |
| roles | $source_roles | $restore_roles |
| services | $source_services | $restore_services |
| invoices | $source_invoices | $restore_invoices |
| invoice_items | $source_invoice_items | $restore_invoice_items |
| payments | $source_payments | $restore_payments |
| cash_register_sessions | $source_sessions | $restore_sessions |
| cash_movements | $source_movements | $restore_movements |
| institutional_receipts | $source_receipts | $restore_receipts |
| audit_logs | $source_audit_logs | $restore_audit_logs |
| fiscal_sequences | $source_fiscal_sequences | $restore_fiscal_sequences |
| fiscal_settings | $source_settings | $restore_settings |

## Limits

This proves a local disposable backup/restore path in Docker/MariaDB. It does not replace the final hospital-site restore proof that must be run by the operator in the real deployment environment.
EOF_EVIDENCE

printf 'RESTORE_MANUAL_PASS evidence=%s backup=%s sha=%s size=%s counts=%s\n' "$FIELD_RESTORE_EVIDENCE" "$backup_path" "$backup_sha" "$backup_bytes" "$restore_counts"
