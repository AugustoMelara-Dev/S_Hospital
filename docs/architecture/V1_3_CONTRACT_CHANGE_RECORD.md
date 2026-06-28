# V1.3 Contract Change Record

## `/api/services` Billing Filter

Previous contract:

- `GET /api/services?billing=1` returned active services visible in billing.
- Frontend sent `visible_in_billing=1` and `is_billable=1`, but backend did not validate or apply those explicit filters.

New contract:

- `billing=1` means `active=1`, `visible_in_billing=1`, and `is_billable=1`.
- `visible_in_billing` and `is_billable` are first-class boolean filters.

Reason:

- POS could show services that backend invoice creation later rejected as non-billable.
- Cashier workflow should fail early in service search, not at invoice emission.

Files:

- `backend/app/Http/Requests/Catalog/IndexServiceRequest.php`
- `backend/app/Http/Controllers/ServiceController.php`
- `backend/tests/Feature/ServiceCatalogTest.php`
- `frontend/src/lib/api/catalog.ts`
- `frontend/src/features/invoices/NewInvoiceView.test.tsx`

Migration:

- None.

Impact:

- POS billing list is stricter.
- Non-billable visible services can still be found with explicit `is_billable=0`.

Tests:

- Backend feature test updated for `billing=1` exclusion and explicit filters.
- Existing frontend POS URL test asserts `visible_in_billing=1` and `is_billable=1`.

Rollback:

- Remove `is_billable` from the `billing=1` backend filter and relax the affected feature test.

Risks:

- If an operator expected non-billable services to appear in POS as informational entries, they will no longer appear in billing mode. That behavior matches invoice creation safeguards.
