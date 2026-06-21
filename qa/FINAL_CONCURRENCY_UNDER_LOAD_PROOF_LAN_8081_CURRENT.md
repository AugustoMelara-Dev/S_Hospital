# Final concurrency under load proof

## Environment

- Date/time: 2026-06-18T03:49:06.865Z
- Responsible person: Automated validation script
- Server LAN URL: http://192.168.1.7:8081
- Target environment: validation
- Run ID: concurrency-load-20260618T03485
- Load user: concurrency.current3
- Mutation user: concurrency.current3
- Load requests/concurrency: 180 / 20
- Final conclusion: Critical cash, invoice, and payment concurrency checks completed while authenticated API load was running against the same Laravel/MariaDB stack.

## Required checks

- [x] Authenticated load had zero failures. Result/evidence: 180 requests, 0 failures, p95 1308 ms.
- [x] Double cash-session open leaves one truth under load. Result/evidence: HTTP 201 / 422.
- [x] Concurrent invoice emission keeps unique numbers under load. Result/evidence: 000-001-01-00000066, 000-001-01-00000065.
- [x] Double payment leaves one posted payment under load. Result/evidence: HTTP 201 / 422.

## Evidence

```json
{
  "status": "VALIDATED",
  "baseUrl": "http://192.168.1.7:8081",
  "target_env": "validation",
  "run_id": "concurrency-load-20260618T03485",
  "executed_at": "2026-06-18T03:49:06.865Z",
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
    "min_ms": 234,
    "p50_ms": 1090,
    "p95_ms": 1308,
    "max_ms": 1402,
    "sample_failures": []
  },
  "checks": {
    "double_cash_open": [
      201,
      422
    ],
    "concurrent_invoice_numbers": [
      "000-001-01-00000066",
      "000-001-01-00000065"
    ],
    "double_payment": [
      201,
      422
    ]
  }
}
```
