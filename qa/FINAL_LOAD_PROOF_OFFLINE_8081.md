# Final local load proof - offline stack 8081

- Base URL: http://127.0.0.1:8081
- Generated at: 2026-06-16T21:47:53.678Z
- Authenticated user: admin.offline
- Total requests: 210
- Concurrency: 30
- Failures: 0
- HTML API responses: 0
- Latency min/p50/p95/max ms: 197/1189/1404/1606

```json
{
  "generated_at": "2026-06-16T21:47:53.678Z",
  "baseUrl": "http://127.0.0.1:8081",
  "total": 210,
  "concurrency": 30,
  "endpoints": [
    "/api/auth/me",
    "/api/reports/dashboard",
    "/api/reports/today",
    "/api/cash-sessions/current",
    "/api/services?search=Glucosa",
    "/api/invoices?per_page=10",
    "/api/backups"
  ],
  "statusCounts": {
    "200": 210
  },
  "failures": 0,
  "htmlResponses": 0,
  "minMs": 197,
  "p50Ms": 1189,
  "p95Ms": 1404,
  "maxMs": 1606
}
```
