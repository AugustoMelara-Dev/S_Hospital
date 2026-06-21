# Final local load proof - LAN IP stack 8081

- Base URL: http://192.168.1.3:8081
- Generated at: 2026-06-16T22:25:09.837Z
- Authenticated user: admin.offline
- Total requests: 210
- Concurrency: 30
- Failures: 0
- HTML API responses: 0
- Latency min/p50/p95/max ms: 317/1383/1699/1796

```json
{
  "generated_at": "2026-06-16T22:25:09.837Z",
  "baseUrl": "http://192.168.1.3:8081",
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
  "minMs": 317,
  "p50Ms": 1383,
  "p95Ms": 1699,
  "maxMs": 1796,
  "sampleFailures": []
}
```
