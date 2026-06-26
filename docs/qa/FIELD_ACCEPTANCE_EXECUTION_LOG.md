# S_Hospital V1.1 - Field Acceptance Execution Log

## Estado general

* SHA probado para auditoria final: `4286887cf7f7e51b56ee27aecdb1b3a6b7d9691f`
* SHA base de evidencia local descartable heredada: `bfa115f15f613a69e81e54a462a5c0e7c9e40f69`
* Fecha: 2026-06-25 America/Tegucigalpa
* Responsable tecnico: Codex, verificacion asistida local
* Operador hospital: PENDIENTE - no disponible en esta sesion
* PC servidor: `AugustoMelara`, Windows, Wi-Fi IPv4 `192.168.1.10`
* PC cliente 1: misma PC servidor para self-check LAN por IP; no cuenta como segunda PC real
* PC cliente 2: PENDIENTE - no disponible en esta sesion
* Impresora: Epson L15150 detectada por Windows; salida fisica no ejecutada en esta sesion
* Red: Wi-Fi LAN `192.168.1.0/24`, gateway `192.168.1.1`; URLs self-check `http://192.168.1.10:8080` y `http://192.168.1.10:8081`
* Resultado general: PENDIENTE - restore descartable local PASS y concurrencia/carga local descartable PASS; gates fisicos LAN/impresion/carga real siguen pendientes

## Auditoria final de campo asistida - 2026-06-25

* Rama de auditoria: `codex/field-acceptance-final-audit`
* SHA probado: `4286887cf7f7e51b56ee27aecdb1b3a6b7d9691f`
* Hora local del servidor: `2026-06-25 22:44:07 -06:00`
* URL LAN preferida: `http://192.168.1.10:8081`
* URL LAN alternativa observada: `http://192.168.1.10:8080`
* Validacion desde servidor: SELF-CHECK PASS, NO SUSTITUYE SEGUNDA PC LAN.
* Safe GET en `8081`: `/` HTTP 200 105 ms, `/login` HTTP 200 47 ms, `/api/health` HTTP 200 85 ms, `/api/system/health` HTTP 200 102 ms, `/api/system/setup-status` HTTP 200 75 ms.
* Safe GET en `8080`: PASS para `/`, `/login`, `/api/health`, `/api/system/health`, `/api/system/setup-status`.
* Salud del sistema en `8081`: base de datos MySQL conectada, `recent_errors=[]`, `failed_last_24h=0`, issue operativo conocido `backup_worker_idle`.
* Docker/stack activo: `shospital_offlinetest-*` healthy en `8081`; `shospital_prodtest-*` healthy en `8080`; `s_hospital_f7_verify-*` healthy en `18080`.
* Impresoras detectadas: `L15150 Series(Network)` driver `EPSON L15150 Series`, puerto `EP8AFB63:L15150 SERIES`, estado Normal; `Epson L15150 Directa` driver `EPSON L15150 Series`, puerto `IP_192.168.1.34_RAW9100`, estado Normal; una instancia WSD del mismo modelo aparece Offline.
* Configuracion de impresora observada: Epson L15150 con `PaperSize=A4`, color, una cara. Windows no reporto impresora predeterminada.
* Salida fisica impresa: NO EJECUTADO - falta operador fisico, confirmacion de papel colocado y ejecucion de impresion con datos sinteticos.
* Checklist generado: `qa/field-acceptance/print-proof-checklist-final-audit-20260625.txt`.
* Produccion fisica aprobada: NO.
* Tag creado: NO.

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
| Carta | Epson L15150 detectada; papel fisico no confirmado | PENDIENTE | Driver observado en A4; no se imprimio recibo/factura sintetica en papel carta. | Checklist generado por `scripts/qa/print-proof-checklist.ps1`; sin salida fisica. |
| Media carta | Epson L15150 detectada; perfil/papel fisico no confirmado | PENDIENTE | Requiere confirmar perfil de media carta en driver y papel colocado. No se imprimio salida fisica. | Checklist generado por `scripts/qa/print-proof-checklist.ps1`; sin salida fisica. |
| A5 | Epson L15150 detectada; perfil/papel fisico no confirmado | PENDIENTE | Requiere confirmar A5 en driver y papel colocado. No se imprimio salida fisica. | Checklist generado por `scripts/qa/print-proof-checklist.ps1`; sin salida fisica. |
| 80mm | No verificado | HARDWARE NO DISPONIBLE | No se detecto impresora termica compatible en esta sesion. | Sin salida fisica. |
| 58mm | No verificado | HARDWARE NO DISPONIBLE | No se detecto impresora termica compatible en esta sesion. | Sin salida fisica. |

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

* Estado: PASS local descartable - PENDIENTE para carga/concurrencia LAN real con dos clientes fisicos
* Clientes: Local descartable `127.0.0.1` contra Laravel/MariaDB en Docker; no hubo dos clientes reales disponibles
* Duracion: ejecucion automatizada local el 2026-06-25/26; no sustituye los 15-30 minutos de campo
* Requests: 24 requests autenticados con concurrencia 4 contra `/api/auth/me`, `/api/reports/dashboard`, `/api/reports/today`, `/api/cash-sessions/current`, `/api/services?search=Glucosa` y `/api/invoices?per_page=10`
* Errores: 0 fallos HTTP en carga autenticada local; status counts `200=24`
* Duplicados: doble apertura de caja produjo HTTP `201/422`; dos facturas concurrentes generaron numeros unicos `000-001-01-00000001` y `000-001-01-00000002`; doble pago produjo HTTP `201/422`
* Resultado: PASS local descartable. Evidencia: `qa/field-acceptance/concurrency-load-local-20260625220353.md`. Limite: sigue pendiente el gate LAN real con dos PCs/clientes fisicos y operador hospitalario.

## Defectos encontrados

| ID | Gate | Severidad | Resumen | Reproduccion | Evidencia | Estado |
| -- | ---- | --------- | ------- | ------------ | --------- | ------ |
| QA-SCRIPT-001 | Preparacion | Baja | `scripts/qa/check-main-state.ps1` tenia SHA por defecto anterior y fallo por manejo interno de parametros de su helper Git. | Ejecutar el script desde rama limpia con SHA actual esperado. | Corregido en esta rama de bitacora; verificado post-commit con `main` y `origin/main` en `bfa115f15f613a69e81e54a462a5c0e7c9e40f69`. | Corregido |
| QA-SCRIPT-002 | Preparacion | Baja | El objetivo operativo invoca `scripts/qa/check-lan-url.ps1 -Url`, pero el script solo aceptaba `-BaseUrl`. | Ejecutar `powershell -ExecutionPolicy Bypass -File scripts/qa/check-lan-url.ps1 -Url "http://192.168.1.10:8081"`. | Corregido en esta rama con alias `Url`; verificado PASS contra `8080` y `8081`. | Corregido |
| QA-SCRIPT-003 | Backup/restore | Baja | `scripts/validate_restore_mysql.sh` fallaba en una imagen con `mktemp: Invalid argument` porque usaba una plantilla con sufijo `.sql` no aceptada por el `mktemp` disponible. | Ejecutar restore cifrado con el script existente contra MariaDB 11.4.3. | Corregido en `codex/field-acceptance-finalize` usando `mktemp -d`, archivos temporales dentro del directorio y cleanup por `trap`. `C:\Program Files\Git\bin\bash.exe -n scripts/validate_restore_mysql.sh` PASS. Runtime restore del script operativo: PENDIENTE en entorno descartable explicito. | Corregido y validado en sintaxis; runtime pendiente |

## Decision final

* Produccion fisica aprobada: NO
* Tag creado: NO
* Firma responsable: PENDIENTE
* Fecha: 2026-06-25
