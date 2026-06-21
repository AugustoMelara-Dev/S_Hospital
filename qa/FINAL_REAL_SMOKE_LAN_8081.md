# Final real smoke LAN 8081

- Estado: PASS
- Fecha: 2026-06-17T16:33:49.094Z
- URL LAN: http://192.168.1.3:8081
- Mutaciones reales: True
- Login navegacion: smoke.current temporal de validacion, desactivado al finalizar
- Login mutacional: smoke.current temporal de validacion, desactivado al finalizar
- Passwords: [redacted validation passwords]
- Resultado: navegacion, consola limpia, emision de factura, cobro, recibo, historial, reportes JSON, export PDF/Excel ejecutivo y cierre de caja pasaron contra Laravel/MariaDB local.
- Evidence/capture reference: qa/FINAL_REAL_SMOKE_LAN_8081.report.json
- Limpieza: usuarios temporales `concurrency.current`, `concurrency.current2` y `smoke.current` desactivados al finalizar; verificado con consulta Laravel que no quedan activos.

## Required checks

- [x] `/up`, `/login`, `/verify-email` and realtime config respond from the LAN URL. Result/evidence: route checks in `qa/FINAL_REAL_SMOKE_LAN_8081.report.json`.
- [x] Login and authenticated navigation complete without console errors. Result/evidence: `console_issues: []` in `qa/FINAL_REAL_SMOKE_LAN_8081.report.json`.
- [x] Cashier can open cashbox, issue invoice, register payment and open receipt. Result/evidence: real cashier workflow passed with paid invoice and receipt checks in `qa/FINAL_REAL_SMOKE_LAN_8081.report.json`.
- [x] History, reprint entry point and reports load from the LAN server. Result/evidence: history/report/export checks passed in `qa/FINAL_REAL_SMOKE_LAN_8081.report.json`.
- [x] Temporary validation users are disabled or removed after the run. Result/evidence: cleanup line above and validation query noted in the run summary.

## Resultados

```json
{
  "generated_at": "2026-06-17T16:33:49.094Z",
  "base_url": "http://192.168.1.3:8081",
  "allow_mutations": true,
  "results": [
    {
      "name": "real hospital workflow surfaces load without console errors",
      "status": "passed",
      "route_checks": {
        "/up": 200,
        "/login": 200,
        "/verify-email": 200,
        "/api/system/echo-config": 200
      },
      "console_issues": []
    },
    {
      "name": "real cashier can issue and collect an invoice against Laravel DB",
      "status": "passed",
      "patient_name": "Smoke Real 1781714020431",
      "cash_session_id": 36,
      "close_status": "closed",
      "report_checks": {
        "/api/reports/today": 200,
        "/api/reports/executive?date_from=2026-06-17&date_to=2026-06-17&cash_session_id=36": 200,
        "/api/reports/daily?date=2026-06-17": 200,
        "/api/reports/monthly?month=2026-06": 200,
        "/api/reports/income?date_from=2026-06-17&date_to=2026-06-17&cash_session_id=36": 200,
        "/api/reports/categories?date_from=2026-06-17&date_to=2026-06-17&cash_session_id=36": 200,
        "/api/reports/services?date_from=2026-06-17&date_to=2026-06-17&cash_session_id=36": 200,
        "/api/reports/operations?date_from=2026-06-17&date_to=2026-06-17&cash_session_id=36": 200,
        "/api/reports/executive/pdf?date_from=2026-06-17&date_to=2026-06-17&cash_session_id=36": 200,
        "/api/reports/executive/excel?date_from=2026-06-17&date_to=2026-06-17&cash_session_id=36": 200
      },
      "console_issues": []
    }
  ]
}
```
