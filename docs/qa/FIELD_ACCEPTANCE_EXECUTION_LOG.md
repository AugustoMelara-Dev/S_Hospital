# S_Hospital V1.1 - Field Acceptance Execution Log

## Estado general

* SHA probado: `bfa115f15f613a69e81e54a462a5c0e7c9e40f69`
* Fecha: 2026-06-25 America/Tegucigalpa
* Responsable tecnico: Codex, verificacion asistida local
* Operador hospital: PENDIENTE - no disponible en esta sesion
* PC servidor: `AugustoMelara`, Windows, Wi-Fi IPv4 `192.168.1.10`
* PC cliente 1: misma PC servidor para self-check LAN por IP; no cuenta como segunda PC real
* PC cliente 2: PENDIENTE - no disponible en esta sesion
* Impresora: PENDIENTE - impresora fisica no disponible en esta sesion
* Red: Wi-Fi LAN `192.168.1.0/24`, gateway `192.168.1.1`; URLs self-check `http://192.168.1.10:8080` y `http://192.168.1.10:8081`
* Resultado general: PENDIENTE - restore descartable local PASS; gates fisicos LAN/impresion/carga siguen pendientes

## Gate 1 - Segunda PC LAN

* Estado: PENDIENTE - segunda PC real no ejecutada
* Evidencia: self-check desde PC servidor por IP LAN PASS en `http://192.168.1.10:8080` y `http://192.168.1.10:8081` usando `scripts/qa/check-lan-url.ps1 -Url`; Docker reporto contenedores S_Hospital `healthy` en stacks `shospital_prodtest`, `shospital_offlinetest` y `s_hospital_f7_verify`.
* Observaciones: la URL LAN responde desde el host servidor, pero no hubo una segunda PC fisica conectada a la LAN. Este gate no puede marcarse PASS.
* Errores: ninguno en GET seguros (`/`, `/login`, `/api/health`, `/api/system/health`, `/api/system/setup-status`) para `8080` y `8081`; `api/system/health` reporto `backup_worker_idle` como issue operativo en los stacks consultados.
* Responsable: Codex, verificacion asistida local

## Gate 2 - Flujo PC1/PC2

* Estado: PENDIENTE - no ejecutado con PC1/PC2 reales
* Evidencia: no se ejecuto flujo de caja/factura/pago entre dos clientes reales en esta sesion.
* Observaciones: requiere operador, usuarios sinteticos y dos clientes separados o dos navegadores aceptados formalmente por operaciones.
* Errores: no aplica; gate no ejecutado.
* Responsable: PENDIENTE

## Gate 3 - Impresion fisica

Tabla por formato:

| Formato | Hardware disponible | Estado | Observacion | Evidencia |
| ------- | ------------------- | ------ | ----------- | --------- |
| Carta | No verificado | PENDIENTE | Impresora fisica no disponible en esta sesion. | Checklist generado por `scripts/qa/print-proof-checklist.ps1`; sin salida fisica. |
| Media carta | No verificado | PENDIENTE | Impresora fisica no disponible en esta sesion. | Checklist generado por `scripts/qa/print-proof-checklist.ps1`; sin salida fisica. |
| A5 | No verificado | PENDIENTE | Impresora fisica no disponible en esta sesion. | Checklist generado por `scripts/qa/print-proof-checklist.ps1`; sin salida fisica. |
| 80mm | No verificado | PENDIENTE | Requiere impresora compatible; hardware no disponible en esta sesion. | Sin salida fisica. |
| 58mm | No verificado | PENDIENTE | Requiere impresora compatible; hardware no disponible en esta sesion. | Sin salida fisica. |

## Gate 4 - Backup/restore

* Estado: PASS local descartable - PENDIENTE para ejecucion final en sitio hospitalario
* Base origen descartable: `s_hospital_test_field_src_20260625213129`
* Base destino descartable: `s_hospital_restore_validation_20260625213129`
* Backup: `storage/app/private/backups/hospital-backup-20260625-213256-lprlqd1y.sql.enc`
* Checksum: `1d4ce6f7e113add9aad6edc241b476190dffa81615e1e0ccb9d0d1238f0fc97b`
* Conteos antes: users=3, roles=5, services=122, invoices=0, invoice_items=0, payments=0, cash_register_sessions=0, cash_movements=0, institutional_receipts=0, audit_logs=91, fiscal_sequences=1, fiscal_settings=1
* Conteos despues: users=3, roles=5, services=122, invoices=0, invoice_items=0, payments=0, cash_register_sessions=0, cash_movements=0, institutional_receipts=0, audit_logs=90, fiscal_sequences=1, fiscal_settings=1
* Resultado: PASS local. El delta de `audit_logs` es 1 porque el evento de exito del backup se registra despues de producir el dump SQL. Evidencia: `qa/field-acceptance/restore-validation-local-20260625213129.md`. No se toco base productiva y los contenedores/base descartables fueron eliminados.

## Gate 5 - Carga/concurrencia

* Estado: PENDIENTE - no ejecutado en LAN real
* Clientes: No hubo dos clientes reales disponibles
* Duracion: No ejecutado
* Requests: Solo GET seguros de self-check local a `8080` y `8081`
* Errores: Sin errores HTTP en self-check; no se ejecuto carga real
* Duplicados: No evaluado
* Resultado: PENDIENTE

## Defectos encontrados

| ID | Gate | Severidad | Resumen | Reproduccion | Evidencia | Estado |
| -- | ---- | --------- | ------- | ------------ | --------- | ------ |
| QA-SCRIPT-001 | Preparacion | Baja | `scripts/qa/check-main-state.ps1` tenia SHA por defecto anterior y fallo por manejo interno de parametros de su helper Git. | Ejecutar el script desde rama limpia con SHA actual esperado. | Corregido en esta rama de bitacora; verificado post-commit con `main` y `origin/main` en `bfa115f15f613a69e81e54a462a5c0e7c9e40f69`. | Corregido |
| QA-SCRIPT-002 | Preparacion | Baja | El objetivo operativo invoca `scripts/qa/check-lan-url.ps1 -Url`, pero el script solo aceptaba `-BaseUrl`. | Ejecutar `powershell -ExecutionPolicy Bypass -File scripts/qa/check-lan-url.ps1 -Url "http://192.168.1.10:8081"`. | Corregido en esta rama con alias `Url`; verificado PASS contra `8080` y `8081`. | Corregido |
| QA-SCRIPT-003 | Backup/restore | Baja | `scripts/validate_restore_mysql.sh` falla en esta imagen con `mktemp: Invalid argument` porque usa una plantilla con sufijo `.sql` no aceptada por el `mktemp` disponible. | Ejecutar restore cifrado con el script existente contra MariaDB 11.4.3. | No afecta producto. Se uso runner local `qa/field-acceptance/run-disposable-restore-local.sh` para completar evidencia descartable; conviene corregir el script operativo antes de entregarlo como comando oficial. | Abierto como mejora de script QA |

## Decision final

* Produccion fisica aprobada: NO
* Tag creado: NO
* Firma responsable: PENDIENTE
* Fecha: 2026-06-25
