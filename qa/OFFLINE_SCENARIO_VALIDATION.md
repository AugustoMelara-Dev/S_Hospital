# Offline Scenario Validation

- Generado: 2026-06-15 13:56:10
- Repositorio: C:\Projects\S_Hospital
- Script: scripts/audit_offline_dependencies.ps1

## Resumen

- Hallazgos CRITICAL: **0**
- Hallazgos INFO: **0**

## Estado

**OFFLINE_OK** - Sin dependencias externas criticas detectadas. El sistema puede operar sin internet.

## Reglas auditadas

- package.json y composer.json sin URL absolutas http/https en dependencias.
- index.html sin scripts/stylesheets desde CDNs publicos.
- Frontend src sin URL externas (fetch, axios, imports, templates).
- Backend app/ sin URL externas (Http::, file_get_contents, curl, etc.).
- Sin referencias a Google Fonts, jsDelivr, unpkg, cdnjs.

## Lista de hosts permitidos

- `localhost`, `127.0.0.1`, `0.0.0.0`
- `soketi`, `redis`, `mysql`, `mariadb` (nombres de servicio Docker)
- IPs privadas `10.*`, `192.168.*`, `172.16-31.*`

