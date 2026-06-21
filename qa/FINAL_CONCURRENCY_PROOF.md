# Final concurrency proof

## Environment

- Date/time: 2026-06-17T08:24:33.424Z
- Responsible person: Automated validation script
- Server LAN URL: http://127.0.0.1:8081
- Target environment: validation
- Run ID: concurrency-validation-20260617T08243
- Evidence/capture reference: %PROJECT_ROOT%\qa\FINAL_CONCURRENCY_PROOF.md
- Final conclusion: Concurrency validation completed against a disposable target. Audit records were intentionally kept in the disposable database.

## Required checks

- [x] Double cash-session open leaves one truth. Result/evidence: HTTP 201 / 422.
- [x] Concurrent invoice emission keeps unique numbers. Result/evidence: 000-001-01-00000039, 000-001-01-00000038.
- [x] Double payment leaves one posted payment. Result/evidence: HTTP 201 / 422.

## Evidence

```json
{
  "status": "VALIDATED",
  "baseUrl": "http://127.0.0.1:8081",
  "target_env": "validation",
  "run_id": "concurrency-validation-20260617T08243",
  "executed_at": "2026-06-17T08:24:33.424Z",
  "cleanup": "NOT_PERFORMED_AUDIT_RECORDS_REQUIRE_DISPOSABLE_DB_SNAPSHOT",
  "checks": {
    "double_cash_open": [
      201,
      422
    ],
    "concurrent_invoice_numbers": [
      "000-001-01-00000039",
      "000-001-01-00000038"
    ],
    "double_payment": [
      201,
      422
    ]
  }
}
```
