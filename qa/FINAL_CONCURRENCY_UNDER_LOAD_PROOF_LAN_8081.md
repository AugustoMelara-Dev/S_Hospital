# Final concurrency under load proof

## Environment

- Date/time: 2026-06-17T17:33:42.173Z
- Responsible person: Automated validation script
- Server LAN URL: http://192.168.1.3:8081
- Target environment: validation-local
- Run ID: concurrency-load-20260617T17333
- Load user: concurrency.current3
- Mutation user: concurrency.current3
- Load requests/concurrency: 180 / 20
- Final conclusion: Critical cash, invoice, and payment concurrency checks completed while authenticated API load was running against the same Laravel/MariaDB stack.

## Required checks

- [x] Authenticated load had zero failures. Result/evidence: 180 requests, 0 failures, p95 1270 ms.
- [x] Double cash-session open leaves one truth under load. Result/evidence: HTTP 201 / 422.
- [x] Concurrent invoice emission keeps unique numbers under load. Result/evidence: 000-001-01-00000062, 000-001-01-00000061.
- [x] Double payment leaves one posted payment under load. Result/evidence: HTTP 201 / 422.

## Evidence

```json
{
  "status": "VALIDATED",
  "baseUrl": "http://192.168.1.3:8081",
  "target_env": "validation-local",
  "run_id": "concurrency-load-20260617T17333",
  "executed_at": "2026-06-17T17:33:42.173Z",
  "load_user": "concurrency.current3",
  "mutation_user": "concurrency.current3",
  "cleanup": "NOT_PERFORMED_AUDIT_RECORDS_REQUIRE_DISPOSABLE_DB_SNAPSHOT",
  "load": {
    "total": 180,
    "concurrency": 20,
    "endpoints": [
      "/api/auth/me",
      "/api/reports/dashboard",
      "/api/reports/today",
      "/api/cash-sessions/current",
      "/api/services?search=Glucosa",
      "/api/invoices?per_page=10"
    ],
    "status_counts": {
      "200": 180
    },
    "failures": 0,
    "html_responses": 0,
    "min_ms": 417,
    "p50_ms": 989,
    "p95_ms": 1270,
    "max_ms": 1401,
    "sample_failures": []
  },
  "checks": {
    "double_cash_open": [
      201,
      422
    ],
    "concurrent_invoice_numbers": [
      "000-001-01-00000062",
      "000-001-01-00000061"
    ],
    "double_payment": [
      201,
      422
    ]
  }
}
```
