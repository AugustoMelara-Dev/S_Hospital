# Evidence: Money DB Constraints
The file `backend/database/migrations/2026_06_09_000002_add_monetary_check_constraints.php` adds DB-level CHECK constraints for MariaDB/MySQL.

```php
DB::statement('ALTER TABLE payments ADD CONSTRAINT payments_amount_cents_nonneg CHECK (amount_cents IS NULL OR amount_cents >= 0)');
DB::statement('ALTER TABLE invoices ADD CONSTRAINT invoices_total_cents_nonneg CHECK (total_cents >= 0)');
DB::statement('ALTER TABLE invoices ADD CONSTRAINT invoices_paid_cents_nonneg CHECK (paid_amount_cents >= 0)');
DB::statement('ALTER TABLE invoices ADD CONSTRAINT invoices_balance_cents_nonneg CHECK (balance_due_cents >= 0)');
DB::statement('ALTER TABLE cash_register_sessions ADD CONSTRAINT cash_register_sessions_opening_cents_nonneg CHECK (opening_amount >= 0)');
DB::statement('ALTER TABLE cash_register_sessions ADD CONSTRAINT cash_register_sessions_closing_cents_nonneg CHECK (closing_amount IS NULL OR closing_amount >= 0)');
```

# Evidence: Cancellation Auditing
The file `backend/app/Actions/Billing/VoidInvoiceAction.php` shows no invoices are deleted. It locks the row and updates the status.
```php
$lockedInvoice->forceFill([
    'status' => Invoice::STATUS_VOID,
    'void_reason' => $reason,
    'voided_by' => $user->id,
    'voided_at' => now(),
])->save();

AuditLog::query()->create([ ... ]);
```
