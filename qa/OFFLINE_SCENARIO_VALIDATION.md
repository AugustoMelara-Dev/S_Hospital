# Offline Scenario Validation

- Generado: 2026-06-17 01:08:55
- Repositorio: C:\Projects\S_Hospital
- Script: scripts/audit_offline_dependencies.ps1

## Resumen

- Hallazgos CRITICAL: **0**
- Hallazgos INFO: **0**

## Estado

**OFFLINE_OK** - Sin dependencias externas criticas detectadas. El sistema puede operar sin internet.

## Reglas auditadas

- package.json y composer.json: ninguna dependencia puede traer URL absoluta http/https.
- index.html: no debe inyectar scripts ni stylesheets desde CDNs publicos.
- Frontend src: ninguna llamada `fetch` o `axios` puede apuntar a hosts fuera de la lista permitida.
- Backend PHP: ninguna llamada `Http::`, `file_get_contents`, `curl_init`, `fsockopen`, `stream_socket_client` puede apuntar fuera de la lista permitida.
- No se permiten referencias a Google Fonts, jsDelivr, unpkg, cdnjs.
- Las llamadas a Pusher/Echo deben apuntar al Soketi local (configurable, no hardcoded a pusher.com).

## Lista de hosts permitidos

- `localhost`, `127.0.0.1`, `0.0.0.0`
- `soketi`, `redis`, `mysql`, `mariadb` (nombres de servicio Docker)
- IPs privadas `10.*`, `192.168.*`, `172.16-31.*` (verificables manualmente)
