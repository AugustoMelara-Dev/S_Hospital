# Final concurrency proof

## Environment

- Date/time: 2026-06-03T11:07:18.161Z
- Responsible person: Automated validation script
- Server LAN URL: http://127.0.0.1:8000
- Target environment: local
- Run ID: concurrency-validation-20260603T11064
- Evidence/capture reference: qa/FINAL_CONCURRENCY_PROOF.md
- Final conclusion: Concurrency validation completed against the local Docker/MariaDB validation target after a fresh backup. Audit records were intentionally kept.

## Required checks

- [x] Double cash-session open leaves one truth. Result/evidence: HTTP 201 / 422.
- [x] Concurrent invoice emission keeps unique numbers. Result/evidence: 000-001-01-00000003, 000-001-01-00000004.
- [x] Double payment leaves one posted payment. Result/evidence: HTTP 201 / 422.

## Evidence

```json
{
  "status": "VALIDATED",
  "baseUrl": "http://127.0.0.1:8000",
  "target_env": "local",
  "run_id": "concurrency-validation-20260603T11064",
  "executed_at": "2026-06-03T11:07:18.161Z",
  "cleanup": "NOT_PERFORMED_AUDIT_RECORDS_REQUIRE_DISPOSABLE_DB_SNAPSHOT",
  "checks": {
    "double_cash_open": [
      201,
      422
    ],
    "concurrent_invoice_numbers": [
      "000-001-01-00000003",
      "000-001-01-00000004"
    ],
    "double_payment": [
      201,
      422
    ]
  }
}
```
