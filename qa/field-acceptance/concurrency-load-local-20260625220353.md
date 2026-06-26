# Final concurrency under load proof

## Environment

- Date/time: 2026-06-26T04:14:13.481Z
- Responsible person: Automated validation script
- Server LAN URL: http://127.0.0.1:18082
- Target environment: local-disposable-validation
- Run ID: concurrency-load-20260626T04060
- Load user: concurrency.local20260625220353.validacion
- Mutation user: concurrency.local20260625220353.validacion
- Load requests/concurrency: 24 / 4
- Final conclusion: Critical cash, invoice, and payment concurrency checks completed while authenticated API load was running against the same Laravel/MariaDB stack.

## Required checks

- [x] Authenticated load had zero failures. Result/evidence: 24 requests, 0 failures, p95 99484 ms.
- [x] Double cash-session open leaves one truth under load. Result/evidence: HTTP 201 / 422.
- [x] Concurrent invoice emission keeps unique numbers under load. Result/evidence: 000-001-01-00000001, 000-001-01-00000002.
- [x] Double payment leaves one posted payment under load. Result/evidence: HTTP 201 / 422.

## Limits

This proof used a local disposable Docker/MariaDB target on 127.0.0.1. It does not replace the required real LAN load/concurrency gate with two physical client PCs and a hospital operator. Production database touched: NO. Real patient data used: NO.

## Evidence

```json
{
  "status": "VALIDATED",
  "baseUrl": "http://127.0.0.1:18082",
  "target_env": "local-disposable-validation",
  "run_id": "concurrency-load-20260626T04060",
  "executed_at": "2026-06-26T04:14:13.481Z",
  "load_user": "concurrency.local20260625220353.validacion",
  "mutation_user": "concurrency.local20260625220353.validacion",
  "cleanup": "NOT_PERFORMED_AUDIT_RECORDS_REQUIRE_DISPOSABLE_DB_SNAPSHOT",
  "load": {
    "total": 24,
    "concurrency": 4,
    "endpoints": [
      "/api/auth/me",
      "/api/reports/dashboard",
      "/api/reports/today",
      "/api/cash-sessions/current",
      "/api/services?search=Glucosa",
      "/api/invoices?per_page=10"
    ],
    "status_counts": {
      "200": 24
    },
    "failures": 0,
    "html_responses": 0,
    "min_ms": 20216,
    "p50_ms": 62830,
    "p95_ms": 99484,
    "max_ms": 100379,
    "sample_failures": []
  },
  "checks": {
    "double_cash_open": [
      201,
      422
    ],
    "concurrent_invoice_numbers": [
      "000-001-01-00000001",
      "000-001-01-00000002"
    ],
    "double_payment": [
      201,
      422
    ]
  }
}
```
