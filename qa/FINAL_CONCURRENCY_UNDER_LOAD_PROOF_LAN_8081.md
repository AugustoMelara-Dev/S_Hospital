# Final concurrency under load proof

## Environment

- Date/time: 2026-06-21T05:50:09.228Z
- Responsible person: Automated validation script
- Server LAN URL: http://192.168.1.2:8081
- Target environment: validation
- Run ID: concurrency-load-20260621T05500
- Load user: load.20260620235001.validacion
- Mutation user: load.20260620235001.validacion
- Load requests/concurrency: 120 / 16
- Final conclusion: Critical cash, invoice, and payment concurrency checks completed while authenticated API load was running against the same Laravel/MariaDB stack.

## Required checks

- [x] Authenticated load had zero failures. Result/evidence: 120 requests, 0 failures, p95 1005 ms.
- [x] Double cash-session open leaves one truth under load. Result/evidence: HTTP 201 / 422.
- [x] Concurrent invoice emission keeps unique numbers under load. Result/evidence: 000-001-01-00000072, 000-001-01-00000073.
- [x] Double payment leaves one posted payment under load. Result/evidence: HTTP 201 / 422.

## Evidence

```json
{
  "status": "VALIDATED",
  "baseUrl": "http://192.168.1.2:8081",
  "target_env": "validation",
  "run_id": "concurrency-load-20260621T05500",
  "executed_at": "2026-06-21T05:50:09.228Z",
  "load_user": "load.20260620235001.validacion",
  "mutation_user": "load.20260620235001.validacion",
  "cleanup": "NOT_PERFORMED_AUDIT_RECORDS_REQUIRE_DISPOSABLE_DB_SNAPSHOT",
  "load": {
    "total": 120,
    "concurrency": 16,
    "endpoints": [
      "/api/auth/me",
      "/api/reports/dashboard",
      "/api/reports/today",
      "/api/cash-sessions/current",
      "/api/services?search=Glucosa",
      "/api/invoices?per_page=10"
    ],
    "status_counts": {
      "200": 120
    },
    "failures": 0,
    "html_responses": 0,
    "min_ms": 64,
    "p50_ms": 792,
    "p95_ms": 1005,
    "max_ms": 1201,
    "sample_failures": []
  },
  "checks": {
    "double_cash_open": [
      201,
      422
    ],
    "concurrent_invoice_numbers": [
      "000-001-01-00000072",
      "000-001-01-00000073"
    ],
    "double_payment": [
      201,
      422
    ]
  }
}
```
