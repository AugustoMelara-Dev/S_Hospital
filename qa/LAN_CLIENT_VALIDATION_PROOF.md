# LAN client validation proof

Estado actual: `VALIDADO_HISTORICO_REQUIERE_REPETIR_IP_FINAL`
Fase: `G - prueba fisica LAN/offline real`
Decision actual: `LAN_CLIENT_VALIDATED_FOR_192_168_1_7_ONLY`

Este archivo documenta evidencia real tomada desde una segunda computadora fisica en la LAN. No usa `localhost`, mocks ni Vite.

Nota de vigencia 2026-06-19: esta evidencia es historica contra `http://192.168.1.7:8081`. No cierra el preflight final actual, porque la BaseUrl final vigente es `http://192.168.1.2:8081`; debe repetirse desde la segunda PC contra esa IP final.

## Environment

- Date/time: 2026-06-17 23:11-23:28
- Responsible person: usuario en segunda PC
- Client computer name: ESTHER-MELARA
- Server IP or LAN name: 192.168.1.7
- Server LAN URL: http://192.168.1.7:8081
- Client browser/version: Microsoft Edge en Windows, evidencia visual adjunta
- User/role used: admin.hospital / Administrador Hospital
- Evidence/capture reference: qa/evidence/lan-client-2026-06-17
- Final conclusion: Segunda PC validada por IP LAN con sesion estable, caja abierta, factura pagada, recibo, historial, reportes, configuracion, usuarios y respaldo manual completado para `192.168.1.7:8081`. Requiere repeticion contra `192.168.1.2:8081` para cerrar entrega final.

## Required checks

- [x] `/up` responds from the client computer. Result/evidence: HTTP 200 desde ESTHER-MELARA; `TcpTestSucceeded=True` hacia 192.168.1.7:8081.
- [x] `/login` loads from the client computer using the server IP or LAN name. Result/evidence: login y dashboard visibles en segunda PC.
- [x] `/verify-email` loads the expected SPA route or documented response. Result/evidence: HTTP 200 desde ESTHER-MELARA.
- [x] `/api/system/echo-config` exposes LAN realtime config. Result/evidence: HTTP 200; response incluye pusher enabled, host 192.168.1.7 y key offlinetest-key.
- [x] `/assets/*.js` loads as JavaScript. Result/evidence: dashboard, caja, historial, reportes y respaldos cargan la SPA desde 192.168.1.7:8081.
- [x] WebSocket/Soketi TCP port is reachable from the client computer. Result/evidence: TCP connect OK desde ESTHER-MELARA hacia 192.168.1.7:8081 (`TcpTestSucceeded=True`); UI muestra estado `Red local` y echo-config expone realtime LAN; no se observo fallo de conexion en la navegacion.
- [x] Login completes without 419 or session-expired state. Result/evidence: usuario `Administrador Hospital` aparece autenticado en dashboard.
- [x] Cashbox opens. Result/evidence: captura `02-cashbox-open.jpg` muestra `Caja #44 abierta`.
- [x] Invoice is created with patient name. Result/evidence: captura `03-invoice-history-paid.jpg` muestra factura `000-001-01-00000067` para paciente `Augusto`.
- [x] Payment is registered. Result/evidence: captura `03-invoice-history-paid.jpg` muestra total L 103.50, pagado L 103.50 y estado `Pagada`.
- [x] Receipt preview opens. Result/evidence: capturas en `qa/evidence/printer-2026-06-17` muestran recibo institucional `REC-A-00000049`.
- [x] Invoice history and reprint work. Result/evidence: historial permite ver recibo y solicita motivo obligatorio para reimpresion auditada.
- [x] Reports load. Result/evidence: captura `04-reports.jpg` muestra reportes con totales ejecutivos.
- [x] Backup request from UI changes from `pending` to `success`. Result/evidence: `qa/evidence/backups-2026-06-17/01-backups-completed.jpg` muestra `hospital-backup-20260617-232509-l4lcnrlw.sql.enc` completado y descargado.

## Evidence

- Screenshot/photo/log reference per step: qa/evidence/lan-client-2026-06-17
- Notes: Validacion funcional LAN completada desde segunda PC. La prueba de impresion fisica en papel se documenta por separado en `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`.
