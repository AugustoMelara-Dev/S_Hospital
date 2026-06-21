# LAN client validation proof

## Environment

- Date/time: 2026-05-19 14:10
- Responsible person: Operador de caja
- Client computer name: CAJA-02
- Server IP or LAN name: 192.168.1.7
- Server LAN URL: http://192.168.1.7:8000
- Client browser/version: Chrome 125
- User/role used: cajero.validacion
- Evidence/capture reference: qa/evidence/lan-client-2026-05-19
- Final conclusion: Segunda PC validada por IP LAN con sesion estable y flujo operativo completo.

## Required checks

- [x] `/up` responds from the client computer. Result/evidence: HTTP 200 registrado en captura 01.
- [x] `/login` loads from the client computer using the server IP or LAN name. Result/evidence: pantalla de login visible en captura 02.
- [x] `/verify-email` loads the expected SPA route or documented response. Result/evidence: ruta SPA responde sin error 500.
- [x] `/assets/*.js` loads as JavaScript. Result/evidence: asset principal con content-type JavaScript.
- [x] Login completes without 419 or session-expired state. Result/evidence: dashboard abre con usuario de caja.
- [x] Cashbox opens. Result/evidence: caja abierta con monto inicial registrado.
- [x] Invoice is created with patient name. Result/evidence: factura generada para Paciente LAN.
- [x] Payment is registered. Result/evidence: pago en efectivo aparece en recibo.
- [x] Receipt preview opens. Result/evidence: vista de recibo institucional media carta visible.
- [x] Invoice history and reprint work. Result/evidence: historial muestra factura y reimpresion abre recibo historico.
- [x] Reports load. Result/evidence: reporte diario carga metricas.
- [x] Backup request from UI changes from `pending` to `success`. Result/evidence: backup manual completo con checksum visible.

## Evidence

- Screenshot/photo/log reference per step: qa/evidence/lan-client-2026-05-19/*.png
- Notes: Validacion hecha desde equipo cliente distinto al servidor.