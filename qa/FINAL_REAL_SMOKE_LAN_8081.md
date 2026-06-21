# Final real smoke LAN 8081

- Estado: PASS
- Fecha: 2026-06-21T05:37:34.925Z
- URL LAN: http://192.168.1.2:8081
- Mutaciones reales: True
- Login navegacion: smoke.final.validacion temporal de validacion, desactivado al finalizar
- Login mutacional: smoke.final.validacion temporal de validacion, desactivado al finalizar
- Passwords: [redacted validation passwords]
- Resultado: navegacion, consola limpia, emision de factura, cobro, recibo, reportes JSON, export PDF/Excel ejecutivo y cierre de caja pasaron contra Laravel/MariaDB local.
- Evidence/capture reference: qa/FINAL_REAL_SMOKE_LAN_8081.report.json
- Limpieza: usuario temporal `smoke.final.validacion` desactivado al finalizar.

## Required checks

- [x] `/up`, `/login`, `/verify-email` and realtime config respond from the LAN URL. Result/evidence: HTTP 200 for all route checks and `/api/system/echo-config`.
- [x] Login and authenticated navigation complete without console errors. Result/evidence: `console_issues: []` in `qa/FINAL_REAL_SMOKE_LAN_8081.report.json`.
- [x] Cashier can open cashbox, issue invoice, register payment and open receipt. Result/evidence: patient `Smoke Real 1782020247222`, cash session `46`, close status `closed`.
- [x] History, reports and exports load from the LAN server. Result/evidence: history navigation passed without console issues; today, executive, daily, monthly, income, categories, services, operations, PDF and Excel endpoints all returned HTTP 200.
- [x] Temporary validation users were disabled after the run. Result/evidence: `hospital:validation-user disable --username=smoke.final.validacion` returned `active: false`.

## Resultados

```json
{
  "generated_at": "2026-06-21T05:37:34.925Z",
  "base_url": "http://192.168.1.2:8081",
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
      "cash_session_id": 46,
      "close_status": "closed",
      "report_endpoint_count": 10,
      "console_issues": []
    }
  ]
}
```
