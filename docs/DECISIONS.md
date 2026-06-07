## 2026-06-05 - Proof fisico de impresion institucional tiene guard focal

Contexto: `qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` bloquea `PRODUCTION_READY`, pero soporte no tenia un comando focal para revisar solo la evidencia de impresora fisica sin correr todo el preflight.

Decision: se agrega `scripts\validate_institutional_receipt_print_proof.ps1`. En modo candidato acepta `-AllowPendingHardwareValidation` solo si el stub conserva media carta, carta, A5, reimpresion, escala 100%, margenes, headers/footers, evidencia fisica y `PRODUCTION_CANDIDATE` sin secretos ni rutas locales. Sin banderas es estricto y falla hasta que la evidencia de la impresora real este completa, marcada y referencie evidencia segura bajo `qa/` o una referencia fisica no local.

Criterio de verificacion: `validate_institutional_receipt_print_proof.ps1 -AllowPendingHardwareValidation`, `validate_final_handoff_completeness.ps1`, `validate_operations_objective_audit.ps1`, `validate_handoff_guard_coverage.ps1`, `make_offline_release.ps1 -SelfTest` y `assert_offline_release_clean.ps1 -SelfTest` deben pasar; `validate_institutional_receipt_print_proof.ps1` sin banderas debe seguir fallando mientras el proof sea pendiente.

## 2026-06-05 - Proof final de respaldos tiene guard focal

Contexto: `qa\FINAL_BACKUP_TASK_PROOF.md` bloquea `PRODUCTION_READY`, pero soporte necesitaba un comando focal para revisar solo la evidencia final de tareas Windows y backup manual UI sin depender de todo el handoff.

Decision: se agrega `scripts\validate_final_backup_task_proof.ps1`. En modo candidato acepta `-AllowPendingFinalField` solo si el stub conserva `SistemaCajaHospitalaria-BackupWorker`, `SistemaCajaHospitalaria-DailyBackup`, worker observado, backup manual, cambio de `pending` a `success/completed` y `PRODUCTION_CANDIDATE` sin secretos ni rutas locales. Sin banderas es estricto y falla hasta que la evidencia del servidor final este completa, marcada y referencie evidencia segura bajo `qa/` o una referencia fisica no local.

Criterio de verificacion: `validate_final_backup_task_proof.ps1 -AllowPendingFinalField`, `validate_final_handoff_completeness.ps1`, `validate_operations_objective_audit.ps1`, `validate_handoff_guard_coverage.ps1`, `make_offline_release.ps1 -SelfTest` y `assert_offline_release_clean.ps1 -SelfTest` deben pasar; `validate_final_backup_task_proof.ps1` sin banderas debe seguir fallando mientras el proof sea pendiente.

## 2026-06-05 - Proof de autoarranque tiene guard focal

Contexto: `qa\FINAL_STARTUP_TASK_PROOF.md` ya bloquea `PRODUCTION_READY`, pero soporte no tenia un comando focal para revisar solo ese proof sin correr todo el preflight u otros gates del handoff.

Decision: se agrega `scripts\validate_final_startup_task_proof.ps1`. En modo candidato acepta `-AllowPendingFinalField` solo si el stub conserva `SistemaCajaHospitalaria-StackAutostart`, `AtStartup`, arranque/reinicio, `/up`, login y `PRODUCTION_CANDIDATE` sin secretos ni rutas locales. Sin banderas es estricto y falla hasta que la evidencia del servidor final este completa, marcada y referencie evidencia segura bajo `qa/` o una referencia fisica no local.

Criterio de verificacion: `validate_final_startup_task_proof.ps1 -AllowPendingFinalField`, `validate_final_handoff_completeness.ps1`, `validate_operations_objective_audit.ps1`, `validate_handoff_guard_coverage.ps1`, `make_offline_release.ps1 -SelfTest` y `assert_offline_release_clean.ps1 -SelfTest` deben pasar; `validate_final_startup_task_proof.ps1` sin banderas debe seguir fallando mientras el proof sea pendiente.

## 2026-06-05 - Autoarranque final exige proof de servidor

Contexto: el handoff y las limitaciones conocidas bloqueaban produccion si `SistemaCajaHospitalaria-StackAutostart` no estaba verificado en el servidor final, pero no existia una evidencia estructurada equivalente a LAN, impresora, restore, backup y capacitacion.

Decision: se agrega `qa\FINAL_STARTUP_TASK_PROOF.example.md` y un stub pendiente `qa\FINAL_STARTUP_TASK_PROOF.md`. El inicializador, preflight, handoff, paquete offline, diagnostico `/api/system/status` y validadores lo tratan como proof final obligatorio. La evidencia real solo debe completarse despues de instalar/actualizar la tarea `AtStartup`, observar arranque/reinicio o ejecucion supervisada, y confirmar `/up` y login sin internet ni intervencion del desarrollador.

Criterio de verificacion: `validate_field_proof_templates.ps1`, `validate_proof_initialization_safety.ps1`, `validate_production_ready_gate_safety.ps1`, `validate_final_field_blockers_safety.ps1`, `validate_installation_docs_safety.ps1`, `validate_system_diagnostics_safety.ps1` y `validate_operations_objective_audit.ps1` deben pasar; el handoff debe conservar `PRODUCTION_CANDIDATE` mientras `qa\FINAL_STARTUP_TASK_PROOF.md` siga pendiente.

## 2026-06-05 - Backup final exige proof de tarea y UI

Contexto: el handoff ya bloqueaba produccion si las tareas `SistemaCajaHospitalaria-BackupWorker` y `SistemaCajaHospitalaria-DailyBackup` no estaban listas, pero la confirmacion de que un backup manual de la UI pasaba de `pending` a `success` quedaba como instruccion suelta y no como evidencia final estructurada.

Decision: se agrega `qa\FINAL_BACKUP_TASK_PROOF.example.md` y un stub pendiente `qa\FINAL_BACKUP_TASK_PROOF.md`. El inicializador, preflight, handoff, paquete offline, diagnostico `/api/system/status` y validadores de evidencia lo tratan como proof final obligatorio. El archivo real solo debe completarse en el servidor final despues de instalar/actualizar tareas y confirmar un backup manual exitoso desde la UI, sin adjuntar `.env`, dumps SQL, passwords, XML de tareas ni rutas absolutas.

Criterio de verificacion: `validate_field_proof_templates.ps1`, `validate_proof_initialization_safety.ps1`, `validate_production_ready_gate_safety.ps1`, `validate_final_field_blockers_safety.ps1`, `validate_backup_restore_docs_safety.ps1`, `validate_installation_docs_safety.ps1`, `validate_system_diagnostics_safety.ps1` y `validate_operations_objective_audit.ps1` deben pasar; el handoff debe conservar `PRODUCTION_CANDIDATE` mientras `qa\FINAL_BACKUP_TASK_PROOF.md` siga pendiente.

## 2026-06-05 - Capacitacion final queda bajo guard estricto

Contexto: `qa\TRAINING_ACCEPTANCE_PROOF.md` bloquea `PRODUCTION_READY` hasta que cajero, supervisor y administrador practiquen en un ambiente aislado. Sin un guard independiente, soporte podia depender solo del preflight completo para detectar si la evidencia seguia pendiente, incompleta o exponia datos sensibles.

Decision: se agrega `scripts\validate_training_acceptance_proof.ps1`. El modo default es estricto y falla mientras la evidencia siga `PENDING_FINAL_FIELD`, tenga campos incompletos, checklists sin marcar, placeholders, rutas locales o secretos. El modo `-AllowPendingFinalField` solo se usa en handoff candidato para aceptar el stub pendiente si conserva bloqueantes explicitos y no expone secretos ni rutas locales.

Criterio de verificacion: `validate_training_acceptance_proof.ps1 -AllowPendingFinalField` debe reportar `TRAINING_ACCEPTANCE_PROOF: YES` con el stub pendiente actual; `validate_training_acceptance_proof.ps1` sin banderas debe fallar hasta que exista evidencia anonimizada real. El handoff, release offline, checklist y auditoria operativa deben mencionar el guard.

## 2026-06-04 - Restore Windows queda bajo guard no destructivo

Contexto: `scripts\restore_hospital_windows.ps1` es el helper local para restaurar en Windows/XAMPP, pero su contrato seguro dependia de recordar ejecutar `-SelfTest` y revisar la documentacion. Un restore equivocado puede sobrescribir datos reales.

Decision: se agrega `scripts\validate_restore_windows_safety.ps1` y el handoff final lo ejecuta. El guard confirma que el helper conserva `-SelfTest`, solo permite nombres de base descartable, rechaza bases productivas, usa entrada segura para password, valida archivos `.sql` o `.tar.gz` y que las guias exigen `qa\FINAL_RESTORE_PROOF.md`.

Criterio de verificacion: `validate_restore_windows_safety.ps1` debe reportar `RESTORE_WINDOWS_SAFETY: YES`; el paquete offline debe incluir `restore_hospital_windows.ps1` y `validate_restore_windows_safety.ps1`; el handoff debe conservar `qa/RESTORE_WINDOWS_SAFETY_2026_06_04.md` antes de considerar cualquier restore en Windows.

## 2026-06-04 - Release offline publica por staging verificado

Contexto: `scripts\make_offline_release.ps1 -Force` reemplazaba `offline-release` durante el proceso de construccion. Si Docker, `docker save` o el guard final fallaban a mitad del flujo, soporte podia perder el ultimo paquete offline disponible.

Decision: el builder ahora crea `offline-release.staging-<id>`, ejecuta el guard sobre staging y solo publica al destino final despues de pasar validacion. Durante el swap mueve el paquete anterior a backup temporal y lo restaura si la publicacion falla. Se agrega `scripts\validate_offline_release_staging_safety.ps1` para preservar este contrato en el handoff.

Criterio de verificacion: `validate_offline_release_staging_safety.ps1` debe reportar `OFFLINE_RELEASE_STAGING_SAFETY: YES`; una prueba con `-SkipDockerBuild -SkipDockerSave` debe fallar por falta de imagenes pero conservar el marcador del release anterior. El handoff debe conservar `qa/OFFLINE_RELEASE_STAGING_SAFETY_2026_06_04.md`.

## 2026-06-04 - Cobertura handoff/offline para guards criticos

Contexto: el handoff final depende de scripts operativos que deben viajar en el paquete offline. La revision post-commit encontro que era posible agregar un guard al handoff y olvidar incluirlo o compararlo en el release offline.

Decision: se agrega `scripts\validate_handoff_guard_coverage.ps1` para comparar las dependencias `Join-Path $scriptsDir` del handoff contra la lista critica de `make_offline_release.ps1`, los `Test-RequiredPath` y los `Test-ReleaseFileMatchesSource` de `assert_offline_release_clean.ps1`. El handoff final ejecuta este guard y conserva `HANDOFF_GUARD_COVERAGE: YES`.

Criterio de verificacion: `validate_handoff_guard_coverage.ps1`, `make_offline_release.ps1 -SelfTest`, `assert_offline_release_clean.ps1 -SelfTest`, `validate_final_handoff_completeness.ps1` y `validate_ops_evidence_index.ps1` deben pasar; `offline-release` debe quedar bloqueado hasta regenerarse desde el commit final si falta cualquier script critico.

## 2026-06-04 - Handoff final ejecuta guards documentados

Contexto: el handoff final listaba validadores de limitaciones conocidas y modo mantenimiento como evidencia preservada, pero no todos corrian dentro de `scripts\final_production_handoff.ps1`. Ademas, el nuevo guard de mantenibilidad de `NewInvoiceView` necesitaba quedar integrado para no depender de memoria del desarrollador.

Decision: `final_production_handoff.ps1` ejecuta y reporta los guards de known-limitations, maintenance mode y NewInvoice maintainability, y `validate_final_handoff_completeness.ps1` falla si el reporte no conserva sus salidas. Tambien se corrige `refresh_lan_ip.ps1` para usar el `-WhatIf` nativo de PowerShell sin parametro duplicado y sin escribir avisos de IP en modo vista previa. El builder y el guard del paquete offline incluyen `validate_new_invoice_maintainability.ps1` como script critico para que una instalacion desde USB no llegue al handoff sin ese validador.

Criterio de verificacion: `validate_lan_recovery_safety.ps1`, `validate_final_handoff_completeness.ps1` y `validate_ops_evidence_index.ps1` deben pasar; el handoff con `-SkipPreflight` conserva `PRODUCTION_CANDIDATE` y los marcadores `KNOWN_LIMITATIONS_SAFETY: YES`, `MAINTENANCE_MODE_SAFETY: YES` y `NEW_INVOICE_MAINTAINABILITY: YES`.

## 2026-06-04 - NewInvoiceView queda bajo guard de mantenibilidad

Contexto: `docs/KNOWN_LIMITATIONS.md` aun describia `NewInvoiceView` como una vista de ~490 lineas pendiente de refactor. La fuente actual ya mide 138 lineas y delega carga de datos, carrito, emision, pagos, atajos, estado y layout a `hooks/`, `state/` y `components/`.

Decision: se reclasifica el pendiente como cerrado y se agrega `scripts\validate_new_invoice_maintainability.ps1` para proteger que `NewInvoiceView.tsx` siga bajo 200 lineas y conserve las extracciones operativas que reducen errores humanos en caja.

Criterio de verificacion: `scripts\validate_new_invoice_maintainability.ps1` reporta `NEW_INVOICE_MAINTAINABILITY: YES`, `scripts\validate_known_limitations_safety.ps1` exige que la deuda no vuelva a aparecer como pendiente y los tests focales de `NewInvoiceView` siguen pasando.
## 2026-06-04 - Coverage critico ya es gate obligatorio de CI

Contexto: `docs/KNOWN_LIMITATIONS.md` y `docs/OPERATIVE_NOTES_2026_06_02.md` aun listaban la cobertura critica >80% como pendiente, aunque `.github/workflows/ci.yml` ya instala `pcov`, ejecuta `phpunit.coverage.xml` y define `HOSPITAL_REQUIRE_COVERAGE=1` en backend-sqlite y backend-mariadb.

Decision: se reclasifica el pendiente como cerrado y `scripts\validate_known_limitations_safety.ps1` verifica que el test `CriticalModulesCoverageTest` mantenga umbral 80%, que CI active coverage y que los modulos Billing, Cash, Payments, Backups y Receipts sigan cubiertos por el gate.

Criterio de verificacion: `scripts\validate_known_limitations_safety.ps1` debe reportar `KNOWN_LIMITATIONS_SAFETY: YES` y `npm run lint` sigue fallando con warnings por `--max-warnings=0`.
## 2026-06-04 - Pulso admin mide latencia y conexiones DB sin exponer consultas

Contexto: `docs/KNOWN_LIMITATIONS.md` conservaba el tablero de salud admin como pendiente porque faltaban metricas reales de latencia P50/P95/P99 y conexiones de base. Sin esas senales, soporte podia ver que el sistema estaba "conectado" pero no distinguir una base lenta o saturada antes de que caja se detuviera.

Decision: `/api/system/health` agrega `database_perf` con una muestra local de latencia, percentiles P50/P95/P99 en cache corto y conexiones activas cuando MySQL/MariaDB reporta `Threads_connected`. La UI admin traduce esos datos a `Respuesta DB` y `Conexiones DB`; usuarios sin `system.status.view` no ven el panel avanzado. El payload publico deja de incluir la ruta local usada para medir espacio en disco.

Criterio de verificacion: `OperationalMetricsExtendedTest` valida el contrato seguro sin consultas SQL visibles, `AboutView.test.tsx` valida las etiquetas humanas y `scripts\validate_system_diagnostics_safety.ps1` exige los campos y bloquea exposicion de rutas, comandos o secretos.
## 2026-06-03 - Rate limit operativo por usuario en LAN

Contexto: varias computadoras de caja pueden compartir la misma IP o ruta LAN. Un throttle por IP en pagos o caja puede bloquear a cajeros distintos cuando solo una estacion repite una accion demasiadas veces.

Decision: las escrituras sensibles de facturas, pagos y caja usan `throttle.user`, que se basa en el usuario autenticado y conserva fallback por IP para requests sin usuario. El mensaje `429` queda en espanol operativo y no expone detalles tecnicos.

Criterio de verificacion: `ThrottleByUserTest` cubre el mensaje seguro, que un cajero no bloquee a otro en la misma IP LAN y que facturas, pagos y caja usen `throttle.user`; `scripts/validate_rate_limit_safety.ps1` guarda el contrato en el handoff.
## 2026-06-03 - Limitaciones conocidas como evidencia operativa

Contexto: `docs/KNOWN_LIMITATIONS.md` es una guia de soporte y cierre. Si conserva pendientes ya resueltos, el personal tecnico puede perseguir problemas falsos o ignorar bloqueantes fisicos reales.

Decision: se agrega `scripts/validate_known_limitations_safety.ps1` para verificar que limitaciones ya guardadas localmente pasen a cerradas con evidencia y que los bloqueantes finales sigan visibles antes de `PRODUCTION_READY`.

Criterio de verificacion: el guard confirma deprecacion del instalador legacy, recuperacion LAN por metrica de ruta, SQL de referencia aislado, canal CSP implementado y final blockers conservados sin exponer secretos.
## 2026-06-03 - Autoarranque seguro del stack Windows

Contexto: la continuidad operativa requiere que el servidor intente levantar el sistema despues de un reinicio sin esperar a que el desarrollador este presente. Ya existia acceso directo y reparacion segura, pero faltaba una tarea dedicada de arranque del stack con evidencia no destructiva.

Decision: se agrega `scripts/install_stack_autostart_windows.ps1` para registrar `SistemaCajaHospitalaria-StackAutostart` con trigger `AtStartup` y accion hacia `scripts/start_hospital_services.ps1`. El script incluye `-WhatIfOnly`, `-Status`, `-UpdateExisting` y `-Uninstall`, requiere Administrador para cambios reales y redacted/sanitiza rutas locales en salida.

Criterio de verificacion: `scripts/validate_startup_repair_safety.ps1` exige el script, valida el dry-run de autoarranque y confirma el trigger `AtStartup`; la guia operativa documenta instalacion, estado y limites seguros sin borrar datos, restaurar backups ni ejecutar seeders.
## 2026-06-02 - Diagnostico avanzado se habilita por permiso, no por rol fijo

Contexto: `/api/system/status` ya esta protegido por `system.status.view`, pero la pantalla **Informacion del sistema** mostraba el diagnostico avanzado solo cuando el usuario tenia rol literal `admin`. Eso impedia asignar una cuenta de soporte local con permiso de diagnostico sin darle control administrativo completo.

Decision: el frontend ahora muestra el diagnostico administrativo cuando el usuario tiene `system.status.view`. La UI mantiene el mismo resumen seguro para usuarios normales y no expone comandos, rutas locales ni variables crudas.

Criterio de verificacion: `AboutView.test.tsx` cubre cajero sin diagnostico avanzado, admin con permiso y usuario de soporte con `system.status.view`; pasan el test focal, typecheck y lint sin errores.
# Technical Decisions - Sistema de Caja Hospitalaria

## Registro de decisiones

### 2026-05-16 - Backend Laravel API

Decision:

- El backend vivira en `backend/` y sera una API Laravel.

Motivo:

- Laravel ofrece migraciones, validacion, policies, transacciones, jobs/comandos y ecosistema estable para una app administrativa local.

Consecuencia:

- La logica de negocio critica vive en backend, no en React.

### 2026-05-16 - Frontend React + TypeScript

Decision:

- El frontend vivira en `frontend/` y usara React + TypeScript.

Motivo:

- Permite una UI rapida para caja, formularios reutilizables y pruebas de componentes/flujos.

Consecuencia:

- TypeScript estricto sera parte del quality gate.

### 2026-05-16 - MySQL/MariaDB

Decision:

- La base de datos sera MySQL/MariaDB local.

Motivo:

- El sistema debe soportar varios clientes en LAN y concurrencia de caja/facturacion.

Consecuencia:

- No se usara SQLite multiusuario.

### 2026-05-16 - Docker como desarrollo reproducible

Decision:

- Docker Compose se usara para desarrollo reproducible.

Motivo:

- Reduce diferencias entre maquinas al implementar y probar.

Consecuencia:

- Produccion offline LAN no dependera de instalar paquetes desde internet al arrancar. Debe documentarse instalacion local/Windows servidor aparte.

### 2026-05-16 - Produccion offline LAN

Decision:

- Produccion corre en una computadora servidor local y clientes acceden por navegador via IP LAN.

Motivo:

- El hospital debe operar sin internet.

Consecuencia:

- Login, facturacion, pagos, reportes, impresion y backups no pueden depender de SaaS obligatorio.

### 2026-05-16 - Paciente solo nombre

Decision:

- La factura requiere solo `patient_name`.

Motivo:

- El alcance inicial es facturacion hospitalaria, no expediente clinico.

Consecuencia:

- No se implementara historia clinica, citas ni expediente completo en el core inicial.

### 2026-05-16 - Snapshots de factura

Decision:

- `invoice_items` guardara snapshots de categoria, servicio, precio, impuesto, total y regla aplicada.

Motivo:

- Las facturas historicas no deben cambiar si se edita el catalogo.

Consecuencia:

- Reimpresion y reportes historicos usan snapshots.

### 2026-05-16 - DECIMAL(12,2) para dinero

Decision:

- Los montos se guardaran como `DECIMAL(12,2)`.

Motivo:

- Evita errores de floats en dinero y es natural para MySQL/MariaDB.

Consecuencia:

- Backend centraliza calculos, redondeos y persistencia.

### 2026-05-16 - No Supabase/Firebase/SQLite multiusuario

Decision:

- No usar Supabase cloud, Firebase ni SQLite para operacion multiusuario.

Motivo:

- El sistema debe ser offline LAN y controlar datos localmente.

Consecuencia:

- Auth, datos, permisos y backups se implementan en Laravel + MySQL/MariaDB.

### 2026-05-16 - Supervisor y gestion de catalogo

Decision:

- `supervisor` puede gestionar catalogo/precios solo si el hospital lo autoriza mediante el permiso `catalog.manage`.

Motivo:

- Algunos hospitales delegan ajustes operativos de catalogo a supervision, pero editar precios afecta directamente facturacion y caja.

Consecuencia:

- En demo puede estar permitido para mostrar flujo operativo, pero en produccion debe ser configurable. El backend siempre valida `catalog.manage`; pertenecer al rol `supervisor` no basta si el permiso no esta asignado.

### 2026-05-17 - Catalogo inicial desde CSV y snapshots futuros

Decision:

- `catalogo_servicios_inicial.csv` es la fuente autorizada para poblar categorias y servicios iniciales con seeder Laravel idempotente.
- Los servicios guardan precio actual en `DECIMAL(12,2)`, `active` y `special_rule_code`; la regla de Eritropoyetina se identifica por nombre normalizado y usa `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`.
- Cambios de servicio, precio y activacion quedan auditados; facturacion futura debera copiar nombre, categoria, precio y regla a snapshots en `invoice_items`.

Motivo:

- El catalogo debe poder corregirse sin alterar facturas historicas y sin depender del CSV en operacion diaria.

Consecuencia:

- Fase 3 no crea facturacion ni `invoice_items`; solo deja el contrato de datos listo para que Fase 4 emita facturas desde snapshots.

### 2026-05-17 - Facturacion transaccional con snapshots

Decision:

- La emision de facturas usa `CreateInvoiceAction` dentro de una transaccion, reserva correlativo fiscal con bloqueo de la fila activa y guarda snapshots completos en `invoice_items`.
- Para evitar mas de una secuencia activa de factura, `fiscal_sequences` mantiene `active_document_type` nullable y unico; solo se llena cuando la secuencia esta activa.
- Los calculos de dinero de Fase 4 se hacen en backend con enteros en centavos y cantidades con dos decimales; React solo muestra una previsualizacion informativa.

Motivo:

- La factura historica debe permanecer estable aunque cambien servicios o precios.
- El correlativo fiscal no puede duplicarse ni consumirse fuera de la transaccion de emision.
- MySQL/MariaDB permite multiples `NULL` en indices unicos, lo que hace compatible una defensa simple para una unica secuencia activa.

Consecuencia:

- Fase 4 no implementa caja, pagos, recibos, reportes, reimpresion ni anulacion.
- Fase 5 debera asociar pagos/caja a facturas ya emitidas sin recalcular `invoice_items`.

### 2026-05-17 - Caja, pagos y recibo institucional MVP

Decision:

- Caja usa `cash_register_sessions` con una caja abierta maxima por cajero validada transaccionalmente en backend.
- La unicidad real de caja abierta se defiende tambien en base de datos con `open_user_id` nullable y unico: solo las cajas abiertas llenan ese campo, y las cajas cerradas lo dejan `NULL` para permitir historico.
- Registro de pago guarda `payments`, `cash_movements` y actualiza `invoices.paid_amount`, `invoices.balance_due` y `invoices.status` dentro de una sola transaccion.
- `expected_amount` de cierre representa efectivo esperado: monto inicial mas pagos en efectivo registrados en la caja.
- El recibo MVP devuelve datos renderizables para media carta/carta/A5 y usa exclusivamente snapshots de `invoice_items` junto con datos fiscales persistidos.

Motivo:

- El flujo vendible necesita login, abrir caja, facturar, cobrar e imprimir sin reportes avanzados ni PDF.
- Caja y pagos son reglas contables sensibles y no deben depender de calculos del frontend.
- Los recibos no pueden cambiar cuando luego se edita el catalogo.

Consecuencia:

- Fase 5 no implementa anulacion de pagos/facturas, reimpresion auditada, historial avanzado, reportes, backups ni PDF avanzado.
- La prueba automatizada valida el constraint en SQLite; la carrera real de dos requests simultaneos debe validarse en MySQL/MariaDB antes de produccion, donde el indice unico `open_user_id` es la defensa final.
- Fase 6 debera agregar reimpresion auditada y anulacion sobre estas bases sin romper los snapshots.

### 2026-05-17 - Historial, reimpresion auditada y anulacion segura

Decision:

- El historial de facturas usa paginacion, filtros por fecha/estado/paciente/numero/cajero/caja y rango de fecha por defecto para evitar traer toda la tabla.
- Cajero queda limitado por backend a facturas propias del dia para historial, detalle, recibo y reimpresion; supervisor/admin usan permisos superiores para facturas historicas o de otros cajeros.
- Reimpresion usa exclusivamente `invoice_items` snapshot y datos fiscales persistidos, y registra `audit_logs` con usuario, factura, ancho y motivo.
- Anulacion marca `status=void`, `void_reason`, `voided_by` y `voided_at` dentro de transaccion y no borra factura ni items.
- Las facturas con pagos registrados se bloquean con 422 hasta que exista un flujo explicito de reversion de pagos/caja.

Motivo:

- Reimprimir o anular son acciones sensibles para caja y auditoria; esconder botones en React no protege datos.
- Sin una reversion contable completa, anular facturas pagadas podria desbalancear caja y pagos historicos.

Consecuencia:

- Fase 6 no implementa anulacion independiente de pagos ni movimientos reversos de caja.
- Una fase futura debe definir reversos auditados antes de permitir anulacion de facturas pagadas o parciales.

### 2026-05-17 - Reportes basicos por agregacion SQL

Decision:

- Los reportes de Fase 7 se calculan en backend con agregaciones SQL sobre `invoices`, `invoice_items`, `payments` y `cash_movements`.
- El reporte diario usa la fecha solicitada o el dia actual por defecto; los reportes por rango requieren `date_from` y `date_to`.
- Los reportes por rango quedan limitados a 31 dias por solicitud para evitar consultas grandes en la operacion LAN.
- Ingresos excluye facturas `void`; el reporte por categoria usa snapshots de `invoice_items.category_name`, no el catalogo actual.
- Reportes de caja se basan en pagos y movimientos asociados a `cash_register_sessions`.

Motivo:

- La demo vendible necesita reporte diario y resumen de caja sin convertir React en fuente contable.
- Los snapshots protegen reportes historicos cuando cambian categorias o servicios.
- El limite de rango conserva tiempos de respuesta razonables en MySQL/MariaDB local.

Consecuencia:

- Fase 7 no implementa dashboard real, exportaciones avanzadas, PDF avanzado, backups, anulacion de pagos, reversos de caja, inventario ni expediente clinico.
- Si se requiere reporte anual o exportacion grande, debe agregarse un flujo posterior paginado/exportado desde backend.

### 2026-05-17 - Backups locales sin restore destructivo por UI

Decision:

- Fase 8 registra `backup_logs`, crea backups locales con `php artisan hospital:backup` y permite al admin listar, solicitar y descargar archivos registrados.
- El backup manual desde UI responde `pending` y se ejecuta en la cola local `backups` para no bloquear el request HTTP.
- Los archivos se guardan en el disco local bajo `storage/app/private/backups`; no se suben a cloud ni se exponen rutas arbitrarias.
- El dump MySQL/MariaDB usa archivo temporal con `--result-file` para evitar cargar el SQL completo en memoria PHP.
- La descarga valida permiso `backups.download`, estado `success`, ruta relativa segura, existencia del archivo y pertenencia a la carpeta de backups.
- Restore queda como procedimiento manual documentado en `docs/BACKUP_RESTORE.md`, primero en entorno de prueba y nunca como boton destructivo en UI.

Motivo:

- En operacion offline LAN el hospital necesita respaldos verificables sin depender de internet.
- Restore desde UI puede destruir datos de caja/facturacion por error y requiere parada controlada.

Consecuencia:

- Admin puede solicitar backup manual y descargarlo para copia local/USB cuando el worker lo complete.
- Produccion debe instalar `mariadb-dump` o `mysqldump` local para dumps reales de MySQL/MariaDB.
- Produccion debe mantener un worker local de cola `backups`.
- Si falta la herramienta de dump, el backup queda registrado como `failed` sin exponer credenciales en logs.

### 2026-05-17 - Production candidate con validaciones reales separadas

Decision:

- Fase 10 separa el estado `PRODUCTION_CANDIDATE` y `PRODUCTION_READY` sin presentar validaciones parciales como entrega final.
- Playwright E2E queda como gate separado en `scripts/e2e_gate.sh`, no mezclado dentro del quality gate seguro.
- Restore MySQL/MariaDB real y concurrencia MySQL/MariaDB real quedan como scripts verificables (`scripts/validate_restore_mysql.sh` y `scripts/validate_mysql_concurrency.sh`) que requieren banderas explicitas antes de tocar entornos reales.
- Produccion same-origin desde Laravel sirve `/`, `/login`, `/verify-email` y `/assets/*` desde `frontend/dist` para que los clientes LAN puedan entrar por IP o nombre del servidor.
- impresora institucional fisica no se marca validada sin hardware; queda checklist operativo en `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md`.

Motivo:

- Production-ready requiere evidencia de entorno real, no solo tests locales.
- Los gates destructivos, de navegador, de restore y de concurrencia tienen riesgos distintos y deben poder ejecutarse de forma independiente.

Consecuencia:

- El estado actual puede ser `PRODUCTION_CANDIDATE`, pero no `PRODUCTION_READY` hasta ejecutar y documentar restore real, concurrencia real, LAN desde cliente fisico e impresion fisica.

### 2026-05-17 - Field deployment validation sin maquillar hardware

Decision:

- Fase 11 registra evidencia de campo en `qa/FIELD_DEPLOYMENT_VALIDATION.md` y gaps en `qa/PRODUCTION_READINESS_GAP_REPORT.md`.
- Restore MySQL/MariaDB real se valida solo contra una base descartable confirmada.
- Concurrencia HTTP/Laravel/MySQL se valida solo contra entorno local/descartable confirmado y deja `RUN_ID` visible en datos auditables.
- LAN desde servidor por IP puede quedar validada, pero LAN fisica completa requiere otra computadora cliente.
- impresora institucional media carta/carta/A5 solo se marca validada con hardware real.

Motivo:

- `PRODUCTION_READY` exige evidencia fisica/operativa, no solo scripts o tests automatizados.

Consecuencia:

- El sistema sigue `PRODUCTION_CANDIDATE` aunque restore y concurrencia local queden validados; falta cliente LAN fisico completo, impresora fisica y configuracion final `APP_ENV=production` con admin real.

### 2026-05-17 - Fase 12 POS, scanner y reportes vendibles

Decision:

- Servicios ahora soportan `scan_code`, `barcode` y `qr_code` como campos opcionales, unicos y buscables.
- La busqueda de servicios incluye nombre, categoria y codigos de escaneo; el POS puede agregar por scanner USB/codigo manual sin confiar en precio o nombre enviados desde React.
- La pantalla de Nueva factura no muestra el catalogo completo por defecto; el cajero debe elegir categoria, buscar o escanear.
- Reportes avanzan con un endpoint de top servicios vendidos basado en snapshots de `invoice_items`, y React exporta CSV desde datos ya calculados por backend.

Motivo:

- La entrega no puede sentirse como una demo con lista interminable de servicios.
- Scanner/codigo es parte del flujo operativo esperado en caja.
- Gerencia necesita ver servicios mas vendidos y exportar datos sin recalcular hechos financieros en frontend.

Consecuencia:

- `scan_code`, `barcode` y `qr_code` quedan bajo permiso `catalog.manage`.
- POS sigue usando `service_id` para emitir; backend conserva precio, impuestos y reglas como fuente de verdad.
- Exportacion CSV actual cubre ingresos, metodos, categorias y servicios cargados; exportaciones masivas o Excel deben ser una fase posterior si el hospital lo exige.

### 2026-05-17 - Fase 12E shell modular y graficos reales

Decision:

- `frontend/src/App.tsx` queda como orquestador de sesion, caja y shell; login, cambio de contrasena, dashboard y rutas privadas viven en archivos propios.
- Reportes usa `Recharts` para graficar servicios mas vendidos con datos ya calculados por backend.
- Vite separa chunks `vendor` y `charts` para evitar un bundle unico grande despues de agregar la libreria de graficos.
- Se actualiza Vitest a la version actual para eliminar vulnerabilidades moderadas de tooling (`npm audit` queda en cero).

Motivo:

- La Fase 12 no debe mantener el olor de una sola pagina gigante ni reportes visuales simulados.
- Los graficos gerenciales y el shell modular hacen mas mantenible la entrega sin cambiar reglas financieras.

Consecuencia:

- `Recharts` queda como dependencia de produccion para reportes.
- TanStack Query/Table y React Hook Form/Zod quedan documentados como adopcion gradual, no como instalacion decorativa sin uso.

### 2026-05-17 - Fase 12A0 alcance operativo de factura y reportes

Decision:

- Los pagos y el listado de pagos usan un guard central de acceso operativo a factura.
- Cajero solo puede operar facturas propias emitidas hoy.
- Supervisor/admin pueden operar facturas historicas o de otros solo por permisos elevados como `invoices.void` o `receipts.reprint_any`.
- `reports.view` queda como permiso de navegacion/compatibilidad, pero los endpoints gerenciales requieren `reports.managerial.view`.
- El reporte de una caja especifica permite `reports.cash_session.view` para caja propia o `reports.managerial.view` para perfiles superiores.

Motivo:

- Un cajero con `payments.create` no debe poder pagar facturas ajenas por ID aunque tenga una caja propia abierta.
- Los reportes gerenciales exponen informacion agregada de negocio y no deben depender de un permiso amplio que tambien podria usarse para caja propia.

Consecuencia:

- Los flujos de pago quedan alineados con historial/reimpresion: cajero limitado a su operacion diaria, perfiles superiores por permiso explicito.
- Si el hospital quiere que un cajero consulte su caja en reportes, debe recibir `reports.cash_session.view`, no `reports.managerial.view`.

### 2026-05-17 - Fase 12D/12E reportes avanzados y smoke real

Decision:

- Los reportes gerenciales por rango aceptan filtros de fecha, caja, cajero, categoria, metodo de pago y estado desde backend.
- Ingresos, categorias, servicios, auditoria operativa y CSV de exportacion usan los mismos filtros validados.
- La auditoria operativa muestra anulaciones, reimpresiones, backups y resumen por cajero con datos del backend.
- El smoke real de LAN/navegador queda separado del E2E automatico y se ejecuta solo con `E2E_REAL_BASE_URL`, `E2E_REAL_LOGIN` y `E2E_REAL_PASSWORD`.

Motivo:

- Reportes avanzados no pueden ser tablas basicas sin filtros ni totales confiables.
- El CSV debe salir del backend para no convertir React en fuente de verdad financiera.
- La prueba real depende de servidor/credenciales/cliente LAN y no debe romper el gate local cuando ese entorno fisico no esta configurado.

Consecuencia:

- `npm.cmd run e2e` conserva el flujo automatizado vendible y no bloquea por hardware/red real ausente.
- `npm.cmd run smoke:real` queda para validar consola limpia y navegacion contra una instalacion real en LAN.

### 2026-05-17 - POS principal exige caja abierta

Decision:

- La pantalla de nueva factura bloquea la emision si no hay caja abierta.
- El camino principal es abrir caja, emitir factura, registrar pago e imprimir recibo.
- Facturas pendientes quedan fuera del flujo principal y requeririan una accion secundaria con permiso y auditoria si el hospital las solicita.

Motivo:

- Para entrenar una cajera y vender el sistema hoy, el flujo no puede confundir factura pendiente con factura cobrada.
- Caja, pago, recibo y auditoria deben quedar conectados desde el inicio de la operacion.

Consecuencia:

- El CTA visible desde POS lleva a Caja cuando falta sesion abierta.
- El backend mantiene sus permisos y reglas; la UI evita el camino operativo ambiguo.

### 2026-05-18 - Preflight final de produccion

Decision:

- `PRODUCTION_READY` queda ligado a evidencia ejecutable del servidor final, no solo a docs.
- `scripts/production_readiness_preflight.ps1` valida entorno production, build frontend, rutas `/up`, `/login`, `/verify-email`, herramientas MySQL/dump, carpeta de backups y pruebas fisicas documentadas.
- `scripts/install_backup_tasks_windows.ps1` registra tareas Windows para worker continuo de backups y backup diario programado.
- La evidencia de segunda PC LAN e impresora fisica se documenta en archivos separados bajo `qa/` y el preflight la exige por defecto.
- La evidencia fisica queda obligatoria por defecto; solo puede omitirse con `-AllowMissingPhysicalProof`, y esa salida no puede llamarse `PRODUCTION_READY`.
- Las tareas Windows no se sobrescriben silenciosamente; `-UpdateExisting` debe usarse de forma explicita.

Motivo:

- El cierre real depende de entorno, red y hardware; esos puntos deben fallar de forma visible hasta que existan pruebas fisicas.

Consecuencia:

- El codigo puede avanzar como paquete operativo listo para servidor final, pero la etiqueta `PRODUCTION_READY` solo se usa despues del preflight completo y evidencia de campo.

### 2026-05-19 - Backups automaticos diarios y permisos manuales

Decision:

- Laravel registra `hospital:backup --type=scheduled` en el scheduler diario a las `02:00`.
- La hora operativa se puede ajustar con `HOSPITAL_DAILY_BACKUP_TIME=HH:MM`.
- El backup automatico queda como tarea de sistema sin usuario web; los backups manuales de UI siguen limitados a `backups.view`, `backups.create` y `backups.download`.

Motivo:

- El servidor LAN debe poder respaldar cada dia aunque nadie entre al panel.
- El panel manual sigue siendo una accion administrativa auditada, no una herramienta disponible para supervisor o cajero.

Consecuencia:

- Produccion puede usar `php artisan schedule:run` via Programador de tareas o el helper Windows directo.
- La UI muestra backups programados como creados por `Sistema`; la seguridad real permanece en backend por permisos.

### 2026-05-19 - Estado operativo visible para backups y produccion final

Decision:

- Se agrega un endpoint admin `/api/system/status` protegido por `backups.view`.
- El endpoint expone estado operativo no secreto: `APP_ENV`, `APP_DEBUG`, `APP_URL`, conexion de cola, driver de base de datos, disponibilidad de herramienta de dump, almacenamiento local, jobs pendientes de backups y bloqueos restantes para `PRODUCTION_READY`.
- La pantalla de Backups muestra ese estado junto al historial de backups para que el admin vea si falta worker, dump local, espacio o evidencia de campo.
- El estado sigue declarando `PRODUCTION_CANDIDATE` y `PRODUCTION_READY=false` hasta validar segunda PC LAN, impresora institucional fisica y entorno final production.
- El endpoint tambien devuelve un bloque `preflight` con checks accionables: entorno production/debug, MySQL/MariaDB, dump tool, storage local, worker continuo, rutas publicas `/up`, `/login`, `/verify-email`, archivos de evidencia LAN/impresora y comandos operativos.

Motivo:

- En produccion offline LAN no basta con que exista un boton de backup; soporte necesita diagnostico inmediato sin leer scripts ni exponer secretos.
- Los bloqueos fisicos no deben maquillarse como aprobados desde codigo.
- El panel debe decir exactamente que falta sin obligar al operador a interpretar logs o documentos largos durante la instalacion.

Consecuencia:

- Cajeros y supervisores siguen sin acceso a estado operativo de backups/servidor.
- La UI ayuda a instalar y operar, pero no reemplaza `scripts/production_readiness_preflight.ps1` ni la evidencia fisica requerida.
- `PRODUCTION_READY` requiere que el preflight final pase sin `-AllowMissingPhysicalProof` y que existan `qa/LAN_CLIENT_VALIDATION_PROOF.md` y `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` completados en el servidor/campo real.

### 2026-05-19 - Helpers de evidencia de campo

Decision:

- Se agregan `scripts\init_production_proofs.ps1` y `scripts\validate_lan_client.ps1`.
- `init_production_proofs.ps1` crea los archivos reales de evidencia desde las plantillas sin marcarlos como completos.
- `validate_lan_client.ps1` se ejecuta desde una segunda PC cliente y verifica `/up`, `/login`, `/verify-email` y el primer asset JS del build, con opcion de escribir un borrador de `qa\LAN_CLIENT_VALIDATION_PROOF.md`.
- La evidencia de login, caja, factura, pago, recibo, reportes, backup e impresora sigue siendo manual/fisica y debe completarse antes del preflight final.

Motivo:

- Las pruebas de campo deben ser repetibles para el operador, pero no se debe fabricar evidencia que solo puede venir del cliente LAN y la impresora real.

Consecuencia:

- El cierre de produccion queda mas guiado: primero se generan archivos, luego se validan rutas desde cliente, despues se completan los flujos fisicos y finalmente se ejecuta `production_readiness_preflight.ps1` sin excepciones.

### 2026-05-31 - Evidencia LAN solo bajo qa

Decision:

- `scripts\validate_lan_client.ps1` solo acepta `-EvidencePath` como archivo Markdown dentro de `qa\`.
- Rutas absolutas, rutas fuera de `qa\` y rutas sin extension `.md` fallan antes de consultar red o escribir evidencia.
- Los errores de ruta informan al operador que no se consulto la red ni se escribio evidencia.

Motivo:

- La evidencia de campo debe quedar compartible dentro del paquete de validacion, no en carpetas personales ni rutas tecnicas locales.
- Un error al copiar comandos no debe crear archivos fuera del sistema ni iniciar validaciones LAN innecesarias.

Consecuencia:

- El responsable tecnico debe usar rutas como `qa\LAN_CLIENT_VALIDATION_PROOF.md`.
- Las capturas/fotos reales siguen siendo fisicas/manuales; el script solo genera el borrador seguro de evidencia LAN.

### 2026-05-31 - GET concurrente y errores visibles en cambio de contraseña

Decision:

- La cola global del cliente API queda limitada a mutaciones; `GET` y `HEAD` se ejecutan en paralelo.
- Las mutaciones siguen pasando por la preparacion CSRF y conservan orden serializado.
- La pantalla de cambio obligatorio muestra el estado/error inline dentro del formulario.

Motivo:

- Dashboard y reportes hacen varias lecturas independientes que no deben bloquearse entre si.
- Los usuarios con contraseña temporal necesitan ver errores de validacion sin depender solo de la barra de estado del shell.

Consecuencia:

- La carga de vistas con varias consultas mejora sin relajar seguridad de mutaciones.
- Errores 422 de cambio de contraseña se muestran en la pantalla activa.

### 2026-05-31 - Retencion conservadora de backups exitosos

Decision:

- Despues de un backup exitoso se podan solo backups `success` mas antiguos que `HOSPITAL_BACKUP_KEEP_SUCCESSFUL`.
- El valor por defecto conserva 30 backups exitosos y nunca baja de 1.
- Backups `pending` o `failed` no se podan automaticamente.

Motivo:

- La PC servidor local tiene almacenamiento finito, pero no se debe borrar la unica recuperacion valida ni evidencia de fallos.
- La retencion debe ser configurable antes de ejecutar `config:cache` en produccion offline.

Consecuencia:

- Cada poda borra solo archivos seguros bajo `backups/`, elimina el registro podado y deja auditoria `backup.pruned`.
- Los operadores siguen viendo fallos recientes para diagnostico, mientras los exitos antiguos no crecen sin limite.

### 2026-05-31 - Setup raiz queda marcado como local

Decision:

- `setup.bat` en la raiz queda etiquetado como setup local/de validacion, no instalador de produccion final.
- El script muestra una confirmacion antes de ejecutar Docker Compose de desarrollo y dirige produccion a `offline-release\setup.bat`.

Motivo:

- El setup raiz puede construir frontend con npm y usar entorno local, por lo que no cumple el contrato offline final.
- Produccion debe salir de un paquete offline regenerado, con assets e imagenes bloqueadas.

Consecuencia:

- Se reduce el riesgo de instalar el entorno dev en el servidor del hospital por error.
- La release final sigue pendiente de regenerar artefactos y validar en hardware real.

### 2026-05-19 - Handoff final de produccion sin evidencia falsa

Decision:

- Se agrega `scripts\final_production_handoff.ps1` como orquestador operativo del cierre final.
- El helper puede inicializar plantillas de evidencia, mostrar estado de tareas de backup y ejecutar `production_readiness_preflight.ps1` sin `-AllowMissingPhysicalProof`.
- El helper no marca LAN ni impresora como validadas; si faltan los archivos reales de evidencia o contienen placeholders, la salida mantiene `PRODUCTION_READY` bloqueado.
- Cada corrida escribe `qa\FINAL_PRODUCTION_HANDOFF_RESULT.md` con decision, bloqueantes, comandos siguientes, estado de tareas de backup y salida del preflight.

Motivo:

- El servidor final necesita un comando de cierre repetible que reduzca errores humanos sin maquillar pruebas fisicas.
- La evidencia de segunda PC LAN, impresora institucional y production env debe seguir siendo verificable y separada de los mocks o pruebas locales.

Consecuencia:

- El operador puede ejecutar un solo handoff guiado, pero `PRODUCTION_READY` sigue dependiendo del preflight completo, archivos de evidencia reales y backup worker funcional.
- Si el helper falla por evidencia faltante, el estado correcto sigue siendo `PRODUCTION_CANDIDATE` con bloqueantes exactos.
- El reporte de handoff es evidencia operativa de la corrida, no sustituto de la evidencia fisica de LAN o impresora.

### 2026-05-19 - Evidencia fisica visible en estado operativo

Decision:

- `/api/system/status` ahora evalua `qa\LAN_CLIENT_VALIDATION_PROOF.md` y `qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` en vez de reportarlos siempre como pendientes.
- La evaluacion marca `pending` si falta el archivo, `partial` si quedan campos/checks/placeholders incompletos y `validated` si el archivo cumple la estructura minima de evidencia.
- Aunque ambas evidencias aparezcan `validated`, el endpoint mantiene `PRODUCTION_READY=false`; la aprobacion final sigue dependiendo de `scripts\production_readiness_preflight.ps1` ejecutado sin bypass en el servidor final.
- La pantalla de Backups muestra el detalle de cada evidencia para que el operador sepa si falta crear el archivo, completar campos o correr el preflight final.

Motivo:

- El panel administrativo debe reflejar avance real de campo sin fabricar aprobacion de produccion desde el codigo.
- La evidencia fisica completa debe ser visible para soporte, pero el cierre final debe seguir siendo un gate ejecutable y auditable.

Consecuencia:

- Cuando el hospital complete segunda PC LAN e impresora, el panel dejara de mostrar esos archivos como pendientes falsos.
- Si alguien copia una plantilla o deja placeholders, el sistema lo mostrara como parcial y no como validado.

### 2026-05-19 - Worker continuo como bloqueo de preflight

Decision:

- `scripts\production_readiness_preflight.ps1` ahora valida en Windows que existan las tareas `SistemaCajaHospitalaria-BackupWorker` y `SistemaCajaHospitalaria-DailyBackup`.
- El worker continuo debe estar en estado `Running`; la tarea diaria debe estar `Ready` o `Running`.
- Si las tareas no existen, estan deshabilitadas o el worker no esta corriendo, el preflight falla y no permite declarar `PRODUCTION_READY`.
- En hosts no Windows, el preflight emite advertencia para validar un servicio equivalente antes del handoff.

Motivo:

- Un backup manual que queda `pending` por falta de worker es un riesgo operativo real; no debe quedar como nota manual si el servidor final es Windows.
- La promesa de backups locales exige automatizacion continua, no solo scripts disponibles en el repo.

Consecuencia:

- El cierre final debe instalar o actualizar tareas con `scripts\install_backup_tasks_windows.ps1 -UpdateExisting`, iniciar `SistemaCajaHospitalaria-BackupWorker` y confirmar que la UI mueve backups de `pending` a `success`.
- Una corrida de preflight en Windows sin tareas instaladas queda bloqueada aunque ambiente, rutas y evidencias fisicas esten completas.

### 2026-05-19 - Robustez operativa final y evidencias durables

Decision:

- El cierre final ahora exige evidencia de restore (`qa\FINAL_RESTORE_PROOF.md`) y concurrencia (`qa\FINAL_CONCURRENCY_PROOF.md`) ademas de LAN e impresora.
- `scripts\validate_restore_mysql.sh` puede escribir evidencia con SHA256, tamano de backup y conteos minimos de tablas restauradas usando `HOSPITAL_RESTORE_EVIDENCE_PATH`.
- `scripts\validate_mysql_concurrency.mjs` puede escribir evidencia durable con `HOSPITAL_CONCURRENCY_EVIDENCE_PATH`.
- Se agrega `scripts\validate_backup_worker_smoke.ps1` para crear un backup por API, esperar `success`, validar SHA256/tamano y escribir evidencia del worker.
- `/api/system/status` queda separado por permiso `system.status.view`, no por `backups.view`, y expone diagnostico no secreto: hora del servidor, zona horaria, jobs/failed_jobs, migraciones y metadata de logs.
- La exportacion CSV de caja propia permite `reports.cash_session.view + reports.export` solo con `cash_session_id`; el backend mantiene `scopedFilters()` como defensa para impedir exportar cajas ajenas.

Motivo:

- Robustez operativa significa pruebas repetibles, no instrucciones sueltas.
- El admin necesita diagnostico local accionable sin exponer secretos ni dar acceso a roles que solo pueden operar backups.
- La caja propia exportable debe ser coherente entre UI y backend sin convertir al cajero en usuario gerencial.

Consecuencia:

- `PRODUCTION_READY` queda bloqueado por cuatro evidencias: segunda PC LAN, impresora fisica, restore final y concurrencia final.
- Backups, restore y concurrencia ahora pueden dejar artefactos verificables en `qa/`.
- Cajeros con permiso de reporte de caja pueden exportar solo su caja si tambien reciben `reports.export`.

### 2026-05-19 - E2E flakiness y mocks incompletos de estado

Decision:

- El test de preparacion para produccion (`production-readiness.spec.ts`) ahora incluye un `page.waitForResponse('**/api/auth/login')` sincronizado con el click de inicio de sesion durante el flujo del administrador.
- El mock de `/api/system/status` se enriquecio para proporcionar todos los campos anidados obligatorios que `BackupsView` lee (incluyendo `environment.server_time`, `environment.timezone`, y todo el objeto `runtime`).
- El listener de Playwright `requestfailed` ahora ignora interrupciones `net::ERR_ABORTED` hacia `/api/health` y `/sanctum/csrf-cookie`.

Motivo:

- Una asincronia en React y Playwright puede provocar que los cambios de ruta naveguen antes de tener el nuevo contexto de autenticacion listo.
- Mocks incompletos para objetos con anidacion profunda (como `systemStatus.runtime.laravel_log.exists` o pasar undefined a `Intl.DateTimeFormat.format()`) lanzaban TypeErrors y RangeErrors. React captaba el error, reintentaba renderizar y causaba un loop de unmount que Playwright registraba como `element was detached from the DOM, retrying` hasta dar timeout a los 90s.
- La navegacion abrupta durante un fetch interrumpe la peticion intencionalmente en el navegador; contarlo como error falso bloqueaba el E2E.

Consecuencia:

- Los tests de E2E ahora son completamente deterministas y pasan consistentemente en ~15 segundos.
- La resiliencia del testing local E2E garantiza que el handoff de produccion offline siga siendo auditable y rapido.

### 2026-05-20 - Rescate visual inicial y contencion de pantalla blanca

Decision:

- El arranque de sesion ya no omite `/api/auth/session` cuando la URL inicial es `/login`; una recarga fuerte con cookie valida recupera el usuario y vuelve al dashboard.
- La aplicacion queda envuelta en `AppErrorBoundary` para evitar una pantalla totalmente blanca si una vista React falla al renderizar.
- El login se reestructura como una pantalla sobria basada en componentes locales tipo shadcn: `Card`, `Input`, `Label`, `Button` y `Alert`, sin decoracion fragil.
- Los tests de frontend agregan `ResizeObserver` mock para cubrir componentes Radix/shadcn usados por dialogos, selects y checkbox.
- El POS conserva atajos internos, pero deja de mostrar una barra de instrucciones visible dentro de la pantalla operativa.

Motivo:

- El usuario reporto recargas que quedaban en blanco e imposibilidad de iniciar sesion; el primer rescate debe proteger el flujo de acceso antes de ampliar el rediseño.
- Un sistema de caja vendible no puede depender de que cada componente renderice perfecto para no dejar al operador sin pantalla.
- La UI debe sentirse como herramienta de caja hospitalaria, no como demo con texto de uso y controles decorativos.

Consecuencia:

- Login, sesion y tests unitarios quedan estabilizados como base para continuar Fase 12.
- Si aparece un fallo de interfaz, el operador vera una pantalla controlada con accion de recarga en lugar de blanco total.
- El siguiente corte debe continuar la migracion de AppShell, POS, caja, tablas y reportes hacia componentes compartidos sin mezclar cambios fiscales o transaccionales no relacionados.

### 2026-05-20 - Shell blanco shadcn y eliminacion de botones manuales

Decision:

- `AppShell`, `Sidebar` y `Topbar` pasan a una base blanca/minimalista usando tokens semanticos (`background`, `card`, `border`, `muted`, `primary`, `secondary`) en vez de clases oscuras `slate/dark`.
- Los botones manuales restantes en login, POS, historial y configuracion fiscal se reemplazan por `Button` local compatible con shadcn.
- `SelectItem` usa icono `Check` de lucide y elimina el simbolo corrupto que aparecia en opciones Radix.
- Se guardan capturas Playwright en `qa/screenshots/login-shadcn-white.png`, `qa/screenshots/dashboard-shadcn-white.png` y `qa/screenshots/billing-pos-shadcn-white.png`.

Motivo:

- La experiencia solicitada exige consistencia visual, blanco/minimalista, controles de libreria y cero botones crudos en la superficie React.
- El shell es la pieza comun de todas las pantallas; estabilizarlo reduce regresiones visuales antes de seguir refinando reportes, caja y configuracion.

Consecuencia:

- `rg '<button' frontend/src` queda sin resultados.
- Las pantallas principales heredan un marco visual consistente y validado con capturas reales.
- La refactorizacion visual puede continuar por pantallas especificas sin volver al shell oscuro anterior.

### 2026-05-21 - Login LAN y cache runtime

Decision:

- El runtime Docker usa `CACHE_STORE=file` para que el rate limiter y el arranque de login no dependan de la tabla `cache` ni de credenciales antiguas de base de datos.
- `setup.bat` detecta la IP de la ruta por defecto activa, escribe `APP_URL` y `SANCTUM_STATEFUL_DOMAINS` en `backend\.env`, y despues ejecuta `config:cache`.
- La URL LAN validada en esta maquina es `http://192.168.1.3:8000`; `http://192.168.1.7:8000` es una IP anterior/no alcanzable en el estado actual.
- La evidencia de navegador queda en `qa/screenshots/lan-dashboard-fixed.png` y la captura de login en `qa/screenshots/lan-login-fixed.png`.

Motivo:

- El login devolvia errores mezclados (`401` de sesion invitada, `422` de credenciales rechazadas y fallos internos de cache) porque el runtime estaba leyendo configuracion LAN/DB inconsistente.
- En una instalacion offline LAN, el operador no debe depender de recordar la IP correcta ni de limpiar caches manualmente.

Consecuencia:

- Un administrador local de validacion puede iniciar sesion por HTTP en `127.0.0.1:8000` y en la IP LAN activa.
- El instalador debe evitar volver a publicar una URL muerta despues de cambios de red o DHCP.

### 2026-05-21 - Headers de seguridad y exportacion PDF protegida

Decision:

- Todas las respuestas pasan por `AddSecurityHeaders`, que agrega `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y una politica CSP conservadora para la SPA local.
- La exportacion PDF de reportes exige `reports.export`, igual que la exportacion Excel, en vez de aceptar solo permiso de visualizacion.
- `/up`, la SPA publica y los assets se sirven sin middleware de sesion para que los smokes de despliegue no dependan de la base de datos cuando solo validan disponibilidad.

Motivo:

- La Fase 1 exige revisar CSRF/Sanctum, headers de seguridad y permisos por rol antes de operar dinero o reportes.
- Exportar cierres y reportes financieros es una accion mas sensible que verlos en pantalla; debe requerir permiso explicito.

Consecuencia:

- `/api/health`, la SPA y las rutas autenticadas heredan hardening HTTP sin depender del servidor web externo.
- Usuarios con `reports.view` o `reports.managerial.view` pero sin `reports.export` no pueden descargar PDF.
- `/up`, `/login` y `/verify-email` pueden validarse despues de `config:cache` aunque el navegador local no tenga abierta una sesion.

### 2026-05-21 - Dark mode, guia reactivable y ayuda interna

Decision:

- El frontend usa tokens CSS dinamicos con `@theme`, de modo que `html.dark` cambia toda la aplicacion sin reinyectar colores desde configuracion fiscal.
- La guia operativa vive en `features/onboarding`, se abre manualmente desde Topbar y solo autoabre si una preferencia local explicita lo permite.
- Se agrega `/help` con guias visuales y FAQ para caja, facturacion, pagos, impresion, reportes y backups.
- Los graficos de dashboard dejan de depender de `ResponsiveContainer` y usan ancho medido para evitar warnings de Recharts en contenedores inestables.

Motivo:

- La caja hospitalaria necesita un tema oscuro real, consistente y accesible para turnos largos, pero sin romper recibos, formularios ni tablas.
- El onboarding debe poder repetirse sin molestar automaticamente al cajero en produccion.
- La ayuda debe estar disponible dentro del sistema offline LAN, sin depender de documentacion externa.
- Los warnings visuales de Recharts escondian problemas reales de layout en QA.

Consecuencia:

- El toggle claro/oscuro afecta shell, tablas, formularios, modales, badges, alertas y dashboard.
- El usuario puede abrir la guia cuando lo necesite y navegar a `/help` desde el sidebar.
- Dashboard queda mas estable en pruebas de navegador y con consola limpia durante cambios de tema.

### 2026-05-21 - Auditoria UX/UI final con capturas de modulos

Decision:

- Se auditaron las pantallas principales con navegador sobre el build servido por Laravel: login, inicio, nueva factura, caja, catalogo, historial, reportes, respaldos, configuracion fiscal, usuarios y ayuda.
- Las capturas y pruebas de interaccion quedaron en `qa/screenshots/ux-cleanup-2026-05-21-browser/`, incluyendo `ux-cleanup-browser-report.json`, `interaction-proof.json`, `settled-screens-proof.json` y `login-proof.json`.
- El shell conserva una sola accion visible para cerrar sesion dentro del menu de usuario; el logout duplicado del sidebar queda fuera de la navegacion principal.
- Los textos visibles evitan conceptos tecnicos como `APP_ENV`, comandos de cola, Laravel/React, `PRODUCTION_READY`, `S_Hospital` y referencias a backups en ingles.
- Los reportes PDF dejan de firmarse con `S_Hospital` y muestran "Respaldos" en vez de "Copias de Seguridad (Backups)".
- La ruta publica `/admin/users` se sirve desde la SPA igual que el resto de modulos internos, para evitar 404 al recargar o navegar directo.
- El nombre del hospital se mantiene editable desde configuracion fiscal y se refleja en login, sidebar/topbar, resumen fiscal y recibos/reportes donde corresponde.

Motivo:

- El cierre UX/UI requiere evidencia visual actual, no solo tests unitarios ni busquedas de texto.
- Un sistema hospitalario LAN no debe mostrar al operador comandos, estados de despliegue o nombres internos del stack.
- Las rutas internas deben soportar recarga directa porque los clientes LAN acceden por navegador y pueden guardar marcadores.

Consecuencia:

- La evidencia visual actual queda versionable y auditable por modulo.
- `npm.cmd run test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, `php artisan test --colors=never --filter=BackupWorkflowTest`, `php artisan test --colors=never --filter=ReportsTest` y `php artisan test --colors=never --filter=ProductionSpaRouteTest` pasan.
- El build conserva una advertencia no bloqueante de Vite por un chunk apenas mayor a 500 kB; debe tratarse como optimizacion posterior, no como bloqueo funcional.

### 2026-05-31 - Contrato de hechos financieros antes de refactors

Decision:

- El frente de informacion financiera se ejecutara por fases pequenas, empezando por evidencia y un contrato backend explicito de hechos financieros.
- Los reportes deben exponer campos con significado estable: facturado, cobrado, pendiente, parcial, anulado, pagos por metodo y efectivo esperado.
- El frontend no sera fuente de verdad para dinero ni estados; solo presentara campos calculados y validados por backend.
- La evidencia de auditoria inicial vive en `qa/financial-data-audit/` y el plan de ejecucion vive en `docs/superpowers/plans/2026-05-31-financial-data-integrity.md`.

Motivo:

- La auditoria inicial detecto riesgos de contrato y entorno: una pantalla de reportes puede mostrar `Saldo pendiente: L. undefined`, el catalogo puede quedarse en estado de carga aunque la API tenga servicios, y la base MariaDB actual tiene esquema pero no datos operativos.
- Administracion necesita totales auditables y trazables, no cifras derivadas por memoria humana o sumas duplicadas en UI.
- Los comandos de prueba y validacion no deben poner en riesgo la base local de trabajo; antes de migraciones o restauraciones se requiere evidencia y backup.

Consecuencia:

- Phase 0 documenta el baseline sin cambiar comportamiento funcional.
- Phase 1 debe introducir pruebas de facturas pagadas, parciales, emitidas y anuladas, con efectivo, tarjeta, transferencia y otros metodos.
- No se considera completo el frente hasta que las capturas, reportes, consultas, migraciones aditivas, pruebas backend/frontend, build, E2E, branding check y smoke de caja/reportes prueben la consistencia end-to-end.

### 2026-05-31 - Datos locales de validacion sin lenguaje demo

Decision:

- El seeder local/testing pasa de datos "demo" a datos de validacion institucional (`DevelopmentValidationSeeder`).
- Las cuentas temporales usan usuarios `*.validacion` y dominio local `hospital-san-isidro.local`, sin exponer lenguaje comercial ni nombres demo en evidencias.
- El `check-branding.ps1` conserva el bloqueo global de nombres internos y ahora revisa superficies de entrega para nombres/cuentas demo concretas.
- Las funciones de saneamiento siguen ocultando nombres heredados de instalaciones previas, pero esos literales se construyen fuera de texto visible para no reaparecer en capturas, mocks ni manuales.

Motivo:

- El objetivo de RC exige que capturas, e2e, seeders locales y manuales no presenten el sistema como una demostracion tecnica.
- Se necesitan datos locales para pruebas y capacitacion, pero deben leerse como validacion operativa temporal, no como producto demo.

Consecuencia:

- Produccion sigue sin ejecutar seeders de validacion fuera de `local` o `testing`.
- El branding check falla si reaparecen nombres de hospital temporales, usuarios con sufijo de demostracion, `hospital-billing.local`, CAI temporal o el seeder anterior en codigo, e2e, tests o manuales clave.

### 2026-05-31 - Build LAN con API relativa

Decision:

- El frontend compilado para ser servido por Laravel usa rutas relativas (`/api` y `/sanctum`) en vez de hornear `http://localhost:8000`.
- Docker Compose deja `VITE_API_BASE_URL` vacio y usa `VITE_DEV_API_PROXY_TARGET=http://backend:8000` solo para el servidor Vite de desarrollo.
- La CSP conserva `connect-src 'self'`, de modo que un build LAN debe hablar con el mismo origen que sirve la SPA.
- El cliente tambien descarta en runtime un `VITE_API_BASE_URL` de loopback cuando la aplicacion se abre por otro host/IP, para proteger builds locales contaminados.

Motivo:

- La validacion visual en `http://127.0.0.1:8000` mostro que el build intentaba llamar a `http://localhost:8000`, y la CSP lo bloqueo. En una computadora cliente LAN el mismo error impediria iniciar sesion por IP del servidor.

Consecuencia:

- Los clientes LAN pueden acceder por `http://IP_DEL_SERVIDOR` sin depender de `localhost` del cliente.
- Si se sirve el frontend separado en desarrollo, Vite proxy resuelve el backend por el servicio Docker `backend` y mantiene las llamadas del navegador como relativas.
- Un build accidental con `http://localhost:8000` ya no rompe login cuando se abre por `127.0.0.1` o por IP LAN.

### 2026-05-31 - Areas institucionales con snapshot financiero

Decision:

- El catalogo incorpora `areas` como dimension institucional separada de categorias tecnicas.
- Cada item facturado guarda `area_id` y `area_name` como snapshot historico junto con categoria, nombre y precio del servicio.
- El reporte `/api/reports/areas` suma desde `invoice_items` y excluye facturas anuladas, de modo que un cambio posterior de area en el catalogo no reescribe ingresos historicos.

Motivo:

- Administracion necesita lectura por area sin depender del estado vivo del catalogo.
- Los cambios de precio, nombre, categoria o area solo deben afectar facturas futuras; las emitidas deben conservar su evidencia original.

Consecuencia:

- Las migraciones son aditivas y permiten servicios o facturas antiguas sin area hasta su normalizacion.
- Los filtros financieros aceptan `area_id` y las pruebas cubren que una factura emitida antes de cambiar el servicio de area sigue reportando contra el area original.

### 2026-05-31 - Snapshot de conciliacion al cerrar caja

Decision:

- El cierre de caja guarda un snapshot de conciliacion con cantidad de pagos, total cobrado, totales por metodo, facturas pendientes y saldo pendiente.
- Los reportes de una caja cerrada usan ese snapshot como fuente auditada en lugar de recalcular el resumen desde pagos o facturas que pueden cambiar despues.
- Las cajas antiguas sin snapshot mantienen fallback al calculo actual para no romper datos existentes.

Motivo:

- Administracion debe poder revisar un cierre despues sin depender de memoria humana ni de que pagos/facturas posteriores sigan iguales.
- Una correccion posterior, como una anulacion, no debe reescribir silenciosamente lo que se conto y audito al momento del cierre.

Consecuencia:

- La migracion es aditiva y nullable para preservar instalaciones existentes.
- El detalle vivo de pagos puede seguir reflejando el estado actual, pero los totales principales del cierre cerrado permanecen historicos.

### 2026-05-31 - Reversión auditable de pagos

Decision:

- Los pagos se corrigen mediante reversión auditable (`status=void`) y no se borran.
- Cada reversión exige permiso `payments.void`, motivo de servidor, usuario, fecha y auditoría.
- La factura se recalcula dentro de la misma transacción desde pagos `posted`, dejando `paid_amount`, `balance_due` y `status` consistentes.

Motivo:

- Caja y reportes deben excluir pagos reversados sin perder la evidencia de que el pago existió.
- Una corrección de método o monto no debe depender de edición manual ni de memoria humana.
- El arqueo debe conservar la huella del reverso con un movimiento negativo asociado al pago original.

Consecuencia:

- Los reportes existentes, que ya filtran pagos `posted`, excluyen reversos automáticamente.
- El detalle de movimientos de caja puede mostrar `payment_void` para explicar por qué el efectivo esperado bajó.
- La UI puede consumir el nuevo endpoint de reversión sin crear una fuente secundaria de verdad para estados de pago.

### 2026-05-31 - Reporte mensual administrativo desde hechos financieros

Decision:

- El reporte mensual administrativo se expone como contrato backend en `/api/reports/monthly`.
- Sus totales salen de `FinancialFactsService`, la misma fuente de verdad usada por reportes diarios y de rango.
- La evolución por fecha se limita a días con actividad financiera para evitar llenar la respuesta con filas vacías sin contexto operativo.

Motivo:

- Administración necesita lectura mensual de facturado, cobrado, pendiente, parcial, anulado y métodos de pago sin sumar manualmente reportes diarios.
- El mensual debe excluir cobros de facturas anuladas y mantener la misma semántica que los reportes existentes.

Consecuencia:

- La UI puede consumir un contrato mensual estable sin recalcular dinero en frontend.
- Las pruebas comparan días activos, métodos y estados para detectar divergencias entre lectura diaria y mensual.

### 2026-05-31 - Export financiero con fuente explicita

Decision:

- El Excel consolidado incluye una hoja `Lectura Financiera`.
- La hoja separa `Facturado`, `Cobrado`, `Pendiente`, `Parcial` y `Anulado`.
- Cada monto incluye una columna `Fuente` con la semantica humana del dato.

Motivo:

- Administracion debe poder presentar un reporte fuera del sistema sin interpretar campos tecnicos ni memorizar reglas.
- Una factura parcial no debe confundirse con pagada y una anulada no debe inflar ingresos.

Consecuencia:

- Los exports usan los mismos hechos financieros backend que alimentan las pantallas.
- Las pruebas abren el XLSX real y verifican montos y fuentes, no solo que el archivo descargue.

### 2026-05-31 - Duplicados de servicios por categoria y area

Decision:

- La unicidad de servicios se valida por `category_id`, `area_id` y `slug`.
- El mismo nombre normalizado puede existir en otra area institucional si el par categoria/area es distinto.
- Mover o renombrar un servicio vuelve a validar ese par para evitar duplicados operativos.

Motivo:

- El catalogo debe evitar duplicados que confundan facturacion dentro de una misma area.
- A la vez, no debe bloquear servicios legitimamente repetidos por area cuando administracion los separa institucionalmente.

Consecuencia:

- La migracion cambia el indice unico antiguo de `category_id + slug` a `category_id + area_id + slug`.
- Las pruebas cubren alta y edicion para que request y base de datos mantengan la misma regla.

### 2026-05-31 - Recibos excluyen pagos reversados

Decision:

- Los recibos y reimpresiones muestran solo pagos `posted`.
- Los pagos reversados (`void`) permanecen en base de datos, movimientos de caja y auditoria, pero no se presentan como cobros vigentes del recibo.
- El cajero mostrado en el recibo se toma del ultimo pago vigente; si no hay pagos, se conserva el emisor de la factura.

Motivo:

- Un recibo debe reflejar cuanto esta cobrado hoy sin mezclar correcciones contables ya anuladas.
- Mostrar un pago reversado junto al pago correcto puede hacer parecer que se cobro dos veces o por un metodo equivocado.

Consecuencia:

- Reimprimir una factura parcial despues de reversar un pago conserva totales historicos de factura, pero lista unicamente los pagos vigentes.
- La trazabilidad del reverso se revisa desde auditoria y movimientos de caja, no desde la seccion de pagos del recibo.

### 2026-05-31 - Anulacion usa pagos vigentes, no trazas reversadas

Decision:

- La anulacion de factura bloquea si existen pagos `posted` o estado financiero activo (`paid_amount`, `partial`, `paid`, saldo distinto al total).
- Los pagos `void` no bloquean por si solos una anulacion posterior; permanecen como evidencia historica.
- La validacion se ejecuta dentro de la transaccion de anulacion con bloqueo de la factura.

Motivo:

- Una factura emitida por error puede necesitar anularse despues de corregir todos sus cobros mediante reversos auditados.
- Contar pagos reversados como cobros vigentes deja facturas en un estado imposible de cerrar administrativamente.

Consecuencia:

- Supervisor/admin pueden anular una factura solo cuando ya no queda dinero vigente asociado a ella.
- La auditoria conserva tanto el reverso del pago como la anulacion de factura, sin borrar evidencia.

### 2026-05-31 - Motivo obligatorio para cambios de precio

Decision:

- Todo cambio de precio de un servicio exige `price_change_reason` validado en servidor.
- El motivo queda guardado en `service_price_histories.reason` y en `audit_logs.new_values.price_change_reason`.
- La interfaz de catalogo solicita el motivo cuando detecta que el precio editado difiere del precio actual.

Motivo:

- El catalogo es base institucional de ingresos; administracion debe saber no solo quien cambio un precio, sino por que.
- Sin motivo, un cambio de tarifa queda contablemente trazable pero administrativamente debil.

Consecuencia:

- Activar, desactivar o corregir datos no financieros de un servicio no exige motivo de precio.
- Un cambio de precio sin motivo falla con validacion 422 antes de tocar el registro.

### 2026-05-31 - Instalador registra worker y respaldo diario

Decision:

- El instalador LAN reutiliza `scripts/install_backup_tasks_windows.ps1` para registrar respaldos en Windows.
- La instalacion de respaldos crea dos tareas: `SistemaCajaHospitalaria-BackupWorker` para procesar respaldos solicitados desde la UI y `SistemaCajaHospitalaria-DailyBackup` para el respaldo automatico diario.
- El instalador conserva migraciones no destructivas y falla con mensaje claro si no tiene permisos de administrador para registrar tareas.

Motivo:

- La pantalla Respaldos depende de un worker activo; una tarea diaria aislada no garantiza que los respaldos manuales solicitados por administracion se procesen.
- La instalacion debe ser guiada para personal tecnico local y evitar pasos invisibles que despues parezcan errores de la aplicacion.

Consecuencia:

- La guia operativa indica como verificar tareas y como reinstalarlas con `install_backup_tasks_windows.ps1 -UpdateExisting`.
- La validacion de entrega debe crear un respaldo manual y confirmar que pase de `Pendiente` a `Protegido`.

### 2026-05-31 - Reversos de pago visibles en auditoria operativa

Decision:

- El reporte operativo expone `payment_void_count` y `payment_voids` como eventos propios, separados de anulaciones de factura y reimpresiones.
- La UI de Auditoria, el export XLSX y el PDF consolidado muestran factura, paciente, metodo, monto, motivo, usuario que reverso y fecha del reverso cuando el formato lo permite.
- Los reversos se filtran por fecha de `voided_at`, metodo, caja, usuario que reverso y filtros de factura cuando aplican.

Motivo:

- Un pago reversado no debe inflar ingresos, efectivo esperado ni recibos, pero administracion necesita verlo sin revisar memoria humana o tablas internas.
- Mezclar reversos con anulaciones de factura oculta la diferencia entre corregir un cobro y cancelar un documento.

Consecuencia:

- El resumen operativo puede reconciliar "que se anulo" contra "que cobro se reverso".
- Los exports e impresiones de auditoria no revelan IDs tecnicos para estos eventos; usan etiquetas humanas de metodo y usuarios.

### 2026-05-31 - PDF consolidado incluye lectura financiera con fuentes

Decision:

- El PDF consolidado del periodo incluye una seccion "Lectura Financiera del Periodo".
- La seccion muestra Facturado, Cobrado, Pendiente, Parcial y Anulado con fuente humana para cada monto.
- Los montos salen del contrato de reportes del backend; el PDF no recalcula totales desde filas visuales.

Motivo:

- Administracion debe poder imprimir o archivar el cierre con las mismas definiciones financieras que ve en pantalla y Excel.
- Separar pendiente, parcial y anulado evita que el PDF se lea como "facturado menos cobrado" sin contexto.

Consecuencia:

- El PDF de rango deja de ser solo un resumen visual y pasa a ser evidencia de rendicion de cuentas.
- Las pruebas capturan el HTML enviado a DomPDF para validar texto, montos y fuentes antes de generar el binario.

### 2026-05-31 - Servicios reportan monto facturado, no recaudado

Decision:

- Las tablas de servicios en reportes exportables etiquetan sus totales como monto facturado.
- El PDF consolidado, el Excel premium y el Top 5 evitan llamar "ventas", "vendido", "recaudado" o "ingreso" generico a totales que provienen de `invoice_items`.
- Los graficos por metodo de pago usan "Cobros" porque su fuente es `payments_by_method`, no facturacion por items.
- Las secciones por area usan "Facturacion por Area" y "Monto Facturado" mientras no exista una asignacion cobrada explicita.
- El Excel premium usa "Facturacion" y "Monto Facturado" en hojas de categoria, area y servicio para mantener el mismo vocabulario que el PDF y la UI.
- La pestaña frontend de servicios usa "facturado" para sus KPI, tablas, graficas y estados vacios cuando consume reportes de servicios/categorias.

Motivo:

- Los reportes de servicios usan snapshots de factura y pueden incluir facturas pendientes o parciales.
- Llamar recaudado o ingreso generico a ese total mezcla cobro con facturacion y puede hacer que administracion presente ingresos cobrados incorrectos.

Consecuencia:

- La recaudacion por metodo sigue usando pagos reales.
- Los ingresos por servicio/area/categoria quedan entendidos como facturacion salvo que un reporte futuro implemente asignacion cobrada explicita.

### 2026-05-31 - Diagnostico operativo de interfaz y LAN

Decision:

- `/api/system/status` expone un resumen no secreto de la interfaz instalada y la direccion LAN configurada.
- El backend solo devuelve estados booleanos, conteo de assets, etiqueta relativa `frontend/dist/index.html`, host configurado y una recomendacion humana.
- La vista de Respaldos muestra esa informacion en detalle avanzado para administracion/soporte.

Motivo:

- Soporte necesita distinguir entre "backend vivo" y "interfaz no compilada" sin ver rutas absolutas ni variables crudas.
- Un cliente usando `localhost` sigue siendo uno de los fallos LAN mas probables; el sistema debe indicarlo antes de la entrega final.

Consecuencia:

- La señal ayuda al diagnostico local, pero no sustituye la prueba fisica desde una segunda PC LAN.
- `PRODUCTION_READY` sigue bloqueado hasta completar evidencia LAN, impresora, restore y concurrencia final.

### 2026-05-31 - Dashboard diferencia facturacion y cobros

Decision:

- El dashboard usa "Facturacion" para montos emitidos desde facturas y "Cobros" para pagos recibidos.
- Se evita "Ventas" como etiqueta de resumen financiero porque puede leerse como ingreso cobrado.
- Los estados vacios de metodos y servicios mencionan cobros registrados o servicios facturados segun la fuente de datos.

Motivo:

- `total_billed` viene de facturas no anuladas y `total_collected` viene de pagos registrados.
- Administracion necesita leer el inicio sin mezclar facturado, cobrado y flujo de efectivo.

Consecuencia:

- La UI del inicio queda alineada con el contrato de reportes y exports.
- Una prueba frontend falla si vuelve a aparecer lenguaje ambiguo en estos indicadores.

### 2026-05-31 - Aislamiento de permisos en pruebas backend

Decision:

- La base de pruebas limpia el `PermissionRegistrar` de Spatie al preparar y destruir cada caso.
- La configuracion de pruebas fuerza cache de aplicacion y cache de permisos a `array`.
- Los helpers de pruebas que asignan roles devuelven una instancia refrescada del usuario antes de usar `actingAs`.

Motivo:

- `CashPaymentsReceiptTest` pasaba cuando se ejecutaban casos aislados, pero fallaba al correr la clase completa con 403 en apertura de caja.
- El fallo provenia de instancias de usuario con relaciones/permisos obsoletos despues de `assignRole`, no de una regresion del flujo real de caja.

Consecuencia:

- La suite backend vuelve a ser una senal confiable para cambios de seguridad, pagos y caja.
- Los cambios quedan limitados a pruebas y no alteran autorizacion de produccion.

### 2026-05-31 - Alcance operativo explicito para facturas

Decision:

- La capacidad de operar cualquier factura para cobro/reversion usa `invoices.operate_any`.
- Permisos de lectura gerencial, reimpresion historica o anulacion no conceden por si solos alcance operativo de pago.
- El endpoint completo `/api/settings/fiscal` queda autenticado y protegido por `settings.fiscal.view`.
- El login consume `/api/settings/branding`, que solo expone datos publicos de marca institucional.

Motivo:

- Reportes y reimpresiones necesitan ver historia, pero eso no debe permitir cobrar una factura ajena si se combinan permisos en un rol futuro.
- La pantalla de login necesita el nombre institucional, no la configuracion fiscal completa ni banderas operativas.

Consecuencia:

- Roles `admin` y `supervisor` reciben `invoices.operate_any` de forma explicita.
- Roles personalizados deben pedir ese permiso si van a cobrar o revertir facturas fuera de su alcance propio del dia.
- La exposicion publica de configuracion queda reducida a branding no sensible.

### 2026-05-31 - Facturas sin cobro quedan auditadas como pago cero

Decision:

- Las facturas cuyo total calculado es L.0.00 siguen quedando `paid`.
- Al emitirlas se crea un registro `payments` por L.0.00, metodo `other`, referencia `Factura sin cobro por regla autorizada`, caja abierta, cajero y fecha.
- El registro tambien guarda `amount_cents = 0` para cumplir el contrato entero usado por reportes y arqueo.
- No se crea movimiento de efectivo para el pago cero.

Motivo:

- La regla de eritropoyetina con receta de dialisis puede producir una factura valida sin cobro.
- Aun sin dinero recibido, la factura pagada debe quedar trazable a caja, cajero, metodo y fecha.

Consecuencia:

- Recibos muestran un pago L.0.00 para explicar el cierre de la factura.
- Reportes monetarios no aumentan recaudacion porque el monto es cero.
- Arqueo de caja no aumenta efectivo esperado por facturas sin cobro.

### 2026-05-31 - Fiscal completo requiere sesion y permiso

Decision:

- `/api/settings/fiscal` queda dentro del grupo autenticado y protegido por permisos del request existente.
- Login y pantallas publicas usan `/api/settings/branding`, que solo expone nombre, color, lema y lineas institucionales visibles.
- Las operaciones elevadas sobre facturas usan el permiso explicito `invoices.operate_any`; ver reportes o reimprimir historico no concede cobro/anulacion operativa.

Motivo:

- La configuracion fiscal completa incluye campos operativos que no deben estar disponibles para visitantes.
- `reports.managerial.view` y permisos de recibos sirven para consulta/auditoria, no para operar facturas de otra caja.

Consecuencia:

- El login conserva identidad institucional sin exponer RTN, CAI, scanner, parciales u otras opciones internas.
- La matriz de permisos separa consulta historica de operacion financiera.

### 2026-05-31 - PDF consolidado evita ventas como cierre financiero

Decision:

- El subtitulo del PDF consolidado usa "Cierre de Operaciones y Facturacion".
- El PDF conserva "Recaudacion" solamente en secciones basadas en pagos reales.
- Las secciones de categoria, area y servicios siguen etiquetadas como facturacion o monto facturado.

Motivo:

- El cierre consolidado mezcla lectura financiera, facturas, cobros, pendientes, anulaciones y auditoria.
- "Ventas" puede ocultar la diferencia entre facturado y cobrado cuando hay facturas parciales o pendientes.

Consecuencia:

- El PDF exportado queda alineado con el dashboard, Excel premium y reportes en pantalla.
- La prueba del PDF falla si vuelve el subtitulo ambiguo de ventas.

### 2026-05-31 - Recibos termicos y reimpresion auditada desde historial

Decision:

- Los tamanos institucionales aceptados son `half_letter`, `letter`, `a5`, `80mm` y `58mm`.
- La vista de recibo desde historial llama a `/api/invoices/{invoice}/reprint` antes de imprimir para registrar auditoria de copia.
- Si la auditoria de reimpresion falla, el componente de recibo no llama al mecanismo de impresion.
- El CSS de impresion define paginas especificas para 80mm y 58mm y mantiene la impresion aislada con `body[data-printing-receipt="true"]`.

Motivo:

- El hospital requiere impresoras termicas de 80mm y opcion 58mm configurable.
- Imprimir desde historial equivale operacionalmente a una reimpresion y debe quedar trazado.

Consecuencia:

- La configuracion fiscal, el wizard, la vista de recibo y los contratos API limitan el recibo a media carta/carta/A5.
- La validacion final sigue pendiente de impresora fisica y driver real de caja.

### 2026-05-31 - Escaner factura solo servicios activos desde backend

Decision:

- La busqueda por codigo del escaner en nueva factura consulta `/api/services` con `active=1` y `billing=1`.
- Se elimina el fallback local contra la lista ya cargada cuando el backend no devuelve coincidencia o falla.
- Las comparaciones de saldo cero en la vista usan centavos parseados, no `Number(...)` directo.

Motivo:

- El catalogo backend es la fuente de verdad para visibilidad, estado activo e importes facturables.
- Un fallback local puede facturar un servicio que acaba de desactivarse o que ya no cumple filtros de facturacion.
- Los montos deben compararse y presentarse con la misma semantica de centavos usada por el resto del flujo.

Consecuencia:

- Si el backend no confirma un codigo activo y facturable, la factura no agrega el servicio.
- La prueba de scanner falla si la consulta vuelve a omitir `active=1`.
- El modal de pago calcula cambio, pago aplicado y saldos parciales sin aritmetica flotante.

### 2026-05-31 - Reporte operativo respeta filtro por area

Decision:

- `/api/reports/operations` aplica `area_id` a anulaciones, reimpresiones, reversos de pago y resumen por cajero.
- Cuando una factura tiene items de varias areas, el total cobrado por cajero se asigna proporcionalmente en centavos usando snapshots de `invoice_items`.

Motivo:

- Los reportes administrativos deben cuadrar cuando administracion filtra por area institucional.
- Sin este filtro, el resumen operativo podia mostrar cajeros y montos de areas no seleccionadas.

Consecuencia:

- El reporte operativo, el reporte de ingresos y el reporte por areas usan el mismo criterio de snapshots para filtros de area.
- El prorrateo operativo evita floats y mantiene el formato final desde centavos.
- La prueba de reportes falla si `area_id` vuelve a omitirse del resumen operativo.

### 2026-05-31 - Dashboard financiero no muestra NaN

Decision:

- El dashboard usa formateadores seguros para montos y cantidades recibidos desde API.
- Los valores no numericos se presentan como `L. 0.00` o `0` unidades, nunca como `NaN` ni como texto tecnico recibido.

Motivo:

- El dashboard es una pantalla de decision rapida para caja y administracion.
- Mostrar `NaN` o cadenas danadas debilita la confianza en los datos financieros.

Consecuencia:

- La UI falla cerrada ante montos malformados y conserva etiquetas humanas.
- La prueba de dashboard falla si vuelven a renderizarse `NaN` o importes crudos invalidos.

### 2026-05-31 - Backups offline usan Docker Compose cuando no existe artisan host

Decision:

- Los wrappers `run_backup_worker.cmd`, `run_scheduled_backup.cmd` y `start_backup_automation.cmd` detectan dos modos: PHP local con `backend\artisan`, o Docker offline con `docker-compose.prod.yml`.
- En modo Docker offline, el worker se asegura con `docker compose up -d queue-worker` y el respaldo diario corre dentro del contenedor backend con `php artisan hospital:backup --type=scheduled`.
- El instalador de tareas de Windows acepta ambos modos y exige `.env`, Docker y compose validos antes de registrar tareas Docker.
- El instalador LAN registra tareas de backup tambien en la ruta Docker, no solo en bare-metal.

Motivo:

- El paquete `offline-release` no incluye una aplicacion PHP host completa bajo `backend\artisan`; contiene imagenes/compose productivos.
- Una tarea programada que depende de PHP local en ese paquete puede quedar instalada pero nunca respaldar datos reales.

Consecuencia:

- El paquete offline falla temprano si falta `.env`, Docker o compose valido.
- La UI puede seguir usando el servicio `queue-worker` para convertir backups manuales de `pending` a `success`.
- La validacion final de restore y scheduler despues de reinicio sigue pendiente del servidor fisico final.

### 2026-05-31 - Preflight distingue bare-metal y paquete Docker offline

Decision:

- `production_readiness_preflight.ps1` usa `backend\.env` para instalaciones PHP/bare-metal y `.env` raiz cuando detecta paquete Docker productivo sin `backend\artisan`.
- En modo Docker valida `docker-compose.prod.yml` con el `.env` productivo y ejecuta `--check` de los wrappers de backups.
- En modo Docker no exige PHP, cliente MySQL, dump tool ni `frontend/dist` en el host, porque esos artefactos viven dentro de las imagenes y se verifican por compose/rutas HTTP.

Motivo:

- El preflight anterior podia bloquear un release Docker correcto por buscar archivos y binarios host de una instalacion bare-metal.
- A la vez, el paquete Docker necesita probar compose, `.env` y wrappers de backup antes del handoff.

Consecuencia:

- El mismo preflight sirve para ambos caminos de instalacion.
- Las pruebas de campo siguen siendo obligatorias para LAN, impresora, restore y concurrencia final.

### 2026-05-31 - Guard obligatorio para artefacto offline

Decision:

- Se agrega `scripts/assert_offline_release_clean.ps1` para validar el paquete `offline-release`.
- El guard bloquea paquetes con `.env` real, logs, respaldos SQL/dumps, bases locales, `node_modules`, evidencia QA local o checksums incompletos.
- Con `-RequireCurrentCommit`, el manifiesto debe referenciar el commit Git actual y no puede conservar texto de RC/stale como "deben regenerarse".
- `final_production_handoff.ps1` ejecuta este guard y no puede decidir `PRODUCTION_READY` si el artefacto offline falla.

Motivo:

- Un sistema offline puede tener codigo correcto y aun asi fallar produccion si el paquete instalado contiene imagenes viejas, secretos o artefactos de prueba.
- La validacion debe ser repetible por soporte antes de copiar el paquete a la PC servidor.

Consecuencia:

- El estado actual sigue `PRODUCTION_CANDIDATE` hasta regenerar el paquete offline y actualizar su manifiesto al commit de entrega.
- Los paquetes con pruebas locales o datos operativos quedan bloqueados antes del handoff.

### 2026-05-31 - Fuentes versionadas para release Docker offline

Decision:

- `backend/Dockerfile.prod`, `nginx/default.conf`, `.dockerignore`, `scripts/load_offline_images.ps1` y `scripts/make_offline_release.ps1` viven en Git.
- El generador de release falla si faltan esos artefactos, si `scripts/assert_production_docker_sources.ps1` detecta `COPY` locales rotos, si el arbol esta sucio sin `-AllowDirty`, o si el guard final no pasa.
- `.dockerignore` excluye secretos, logs, respaldos, `node_modules`, `vendor`, `qa` y worklogs del contexto de build.

Motivo:

- `docker-compose.prod.yml` no era reproducible desde Git porque referenciaba archivos que solo existian dentro de `offline-release`, una carpeta ignorada.
- Un release offline debe poder reconstruirse desde un commit limpio, no desde artefactos manuales previos.

Consecuencia:

- La ruta Docker offline queda versionada y auditable.
- La generacion final todavia requiere Docker y puede requerir internet en la maquina de build para descargar bases de imagenes si no estan cacheadas.

### 2026-05-31 - Instalador sin opcion destructiva de limpieza

Decision:

- El menu de instalacion previa para Docker ya no ofrece "instalacion limpia" ni confirma borrado de volumenes.
- Ante una instalacion existente, las opciones son reparar contenedores, actualizar conservando base de datos o cancelar para pedir soporte.

Motivo:

- En el hospital, una respuesta de emergencia no debe depender de que una persona no tecnica entienda el alcance de `down -v` o eliminacion manual de volumenes.
- La recuperacion segura debe proteger facturas, pagos, caja, auditoria y respaldos aun cuando el sistema no arranque.

Consecuencia:

- Cualquier operacion destructiva queda fuera del instalador operativo y requeriria un procedimiento tecnico separado, con backup verificado y aprobacion explicita.
- El soporte de primer nivel tiene un camino claro: reparar, actualizar sin borrar o detenerse.

### 2026-05-31 - Caja no renderiza montos invalidos como NaN

Decision:

- Las vistas de caja usan el formateador financiero seguro para apertura, efectivo esperado, metodos de pago, saldo pendiente, contado y diferencia.
- Si una respuesta de caja trae un monto no numerico, la UI lo presenta como `L. 0.00` y no como `NaN` ni como texto tecnico.

Motivo:

- Caja es una pantalla de conciliacion y cierre; un monto malformado visible puede provocar decisiones incorrectas.
- La precision visual debe fallar cerrada mientras backend y tests siguen siendo la fuente de verdad de la conciliacion.

Consecuencia:

- El cierre de caja mantiene etiquetas humanas aun ante datos de API danados.
- La prueba de caja falla si vuelve a mostrarse `NaN` o un monto crudo invalido.

### 2026-06-01 - Capturas RC mockeadas son evidencia visual, no validacion fisica

Decision:

- El E2E de production readiness puede generar capturas con `E2E_CAPTURE_RC_SCREENSHOTS=1`.
- Las capturas se guardan por defecto bajo `qa/screenshots/rc-e2e-mocked-2026-06-01` junto con un JSON de rutas, tema visual y errores de consola.
- El reporte declara explicitamente que la API esta mockeada y que no sustituye validacion LAN, MySQL/MariaDB ni impresora fisica.

Motivo:

- El frente financiero necesita evidencia repetible de caja, factura, recibo, reportes y respaldos sin depender de datos reales.
- La evidencia mockeada ayuda a detectar roturas visuales y de flujo, pero no prueba infraestructura offline ni hardware.

Consecuencia:

- Se puede capturar evidencia UI bajo demanda sin ensuciar cada corrida de E2E.
- La validacion final sigue requiriendo capturas y pruebas contra entorno local real y dispositivos fisicos.

### 2026-05-31 - Estados de respaldo visibles sin lenguaje tecnico

Decision:

- El resumen normal de respaldos usa solo estados humanos: `Protegido`, `Pendiente` o `Error`.
- Los detalles operativos conservan informacion de soporte, pero la primera lectura evita etiquetas de candidato, demo o revision tecnica.

Motivo:

- El personal no tecnico necesita saber si el hospital esta protegido, si falta algo o si debe pedir soporte.
- La pantalla de respaldos no debe sonar como un preflight de desarrollo durante una operacion real de caja.

Consecuencia:

- La prueba de respaldos falla si vuelve a mostrarse `requiere revision` en la superficie normal.
- El detalle avanzado sigue disponible para administracion o soporte.

### 2026-05-31 - Tamanos de recibo institucional centralizados

Decision:

- Los tamanos de recibo institucional se definen en `frontend/src/lib/institutionalReceiptPaper.ts`.
- Configuracion fiscal, wizard inicial, recibo nuevo e historial usan la misma lista: media carta, carta, A5, 80mm y 58mm.
- Valores malformados de API o UI se normalizan a media carta antes de pedir, reimprimir o renderizar recibos.

Motivo:

- La caja no debe depender de listas duplicadas para decidir el papel de impresion.
- Un valor invalido de configuracion no debe romper el recibo ni reactivar lenguaje de ticket informal en la experiencia visible.

Consecuencia:

- Las opciones 80mm/58mm quedan tratadas como valores heredados y se convierten a media carta.
- La validacion fisica de impresora sigue pendiente del hardware real, pero el contrato visual/frontend queda uniforme y probado.

### 2026-05-31 - Branding check bloquea lenguaje de ticket heredado

Decision:

- `scripts/check-branding.ps1` revisa superficies de entrega para impedir que vuelva lenguaje visible de ticket o rollo informal.
- `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md` valida media carta, carta, A5, 80mm y 58mm.

Motivo:

- El recibo final debe sentirse como comprobante institucional del hospital, tambien cuando se imprime en 80mm o 58mm.
- Una guia de validacion fisica debe probar todos los tamanos visibles sin promover lenguaje informal.

Consecuencia:

- El gate de branding falla si UI, manuales o evidencia clave vuelven a promover tickets de rollo.
- El CSS visible queda limitado a formatos institucionales de pagina.

### 2026-05-31 - Documentos de entrega sin lenguaje de demostracion

Decision:

- `qa/RELEASE_READINESS.md` y `docs/KNOWN_LIMITATIONS.md` usan lenguaje de RC institucional, no de demo comercial.
- `scripts/check-branding.ps1` bloquea en documentos de entrega terminos como estado demo, producto vendible, credenciales demo, usuarios demo y ticket informal.

Motivo:

- La entrega al hospital debe sonar a sistema operativo serio, aun cuando conserve pendientes honestos de hardware y entorno.
- Los documentos de entrega pueden compartirse con administracion o soporte; no deben reforzar la percepcion de prototipo o venta.

Consecuencia:

- Se conserva `PRODUCTION_CANDIDATE` como estado honesto hasta cerrar LAN, impresora, restore y concurrencia finales.
- Los documentos de entrega describen credenciales y seeders como validacion local temporal, no como datos demo.

### 2026-06-01 - Prompts agenticos alineados a recibo institucional

Decision:

- Los prompts de planificacion, revision, ejecucion POS, review de commit y readiness revisan recibo institucional media carta/carta/A5.
- `scripts/check-branding.ps1` incluye `prompts/` en las reglas que bloquean lenguaje de recibo heredado y entrega no institucional.
- El prompt maestro deja de apuntar a documentos con nombre heredado y a referencias de impresion de rollo.

Motivo:

- El flujo agentic obligatorio no debe volver a introducir requisitos incompatibles con el objetivo actual del Hospital San Isidro.
- Los prompts son parte del producto operativo del repo: guian futuras fases, revisiones y criterios de aprobacion.

Consecuencia:

- Futuras fases quedan orientadas al recibo institucional, sin QR, barcode, codigos internos ni datos tecnicos.
- El branding check falla si prompts de entrega vuelven a usar lenguaje de ticket heredado o demo comercial.

### 2026-06-01 - API de recibos acepta formatos institucionales configurables

Decision:

- Backend valida recibos y reimpresiones con `half_letter`, `letter`, `a5`, `80mm` y `58mm`.
- Configuracion fiscal rechaza `receipt_width` heredado y `receipt_paper_size` fuera de media carta/carta/A5.
- Snapshots antiguos con valores desconocidos se normalizan a media carta al generar recibo o reporte.
- `FiscalSetting` deja de exponer `receipt_width` en respuestas JSON normales.

Motivo:

- La UI ya no promueve ticket de rollo; el contrato Laravel debe sostener los tamanos configurables vigentes para evitar regresiones por API, tests o integraciones locales.
- Los recibos historicos deben seguir imprimibles sin recalcular facturas, pero no deben reactivar valores desconocidos.

Consecuencia:

- Reimpresion y vista de recibo devuelven error de validacion si se pide un ancho desconocido.
- Facturas antiguas con snapshot desconocido siguen abriendo como media carta institucional.

### 2026-06-01 - Exportes administrativos sin marca tecnica

Decision:

- El Excel premium de reportes usa `Logo Institucional` como placeholder cuando no hay logo cargado o el archivo de logo falla.
- `scripts/check-branding.ps1` bloquea `HOSPITAL OS` en superficies de producto y entrega.

Motivo:

- Los reportes exportados pueden presentarse a administracion y auditoria; no deben incluir marca tecnica, nombres internos ni placeholders ajenos al hospital.
- El encabezado del reporte ya muestra el nombre institucional y RTN configurados, por lo que el bloque visual debe ser neutral cuando no existe logo.

Consecuencia:

- La prueba de reportes abre el XLSX generado y falla si vuelve a aparecer `HOSPITAL OS`.
- Los exports siguen funcionando sin depender de que el hospital haya cargado un logo.

### 2026-06-01 - Auditoria operativa sin ids tecnicos

Decision:

- `/api/reports/operations` ya no expone `invoice_id` en anulaciones/reimpresiones, `user_id` en cajeros, ni `id`/`checksum_sha256` en respaldos.
- React usa claves de render derivadas de factura, usuario, archivo y fecha humana en lugar de ids internos.

Motivo:

- La auditoria operativa debe servir para administracion y rendicion de cuentas, no para exponer claves internas que no ayudan a entender el movimiento.
- Exportes y pantallas deben presentar fuentes humanas: factura, paciente, cajero, motivo, fecha, estado y monto.

Consecuencia:

- Las pruebas de reportes fallan si vuelven `invoice_id`, `user_id`, `id` de backup o checksum al contrato publico de auditoria.
- Los filtros internos por usuario, caja, categoria y area siguen siendo validados por backend, pero no se usan como identificadores visibles en la tabla.

### 2026-06-01 - PDF diario reservado a gerencia

Decision:

- `/api/reports/pdf?date=...` queda reservado a usuarios con `reports.managerial.view` ademas de `reports.export`.
- Usuarios con solo `reports.cash_session.view` no pueden descargar el cierre diario gerencial; deben usar reportes acotados a su caja cuando el flujo lo permita.

Motivo:

- El PDF diario resume cifras de administracion: facturado, cobrado, pendiente, anulaciones y metodos del dia completo.
- Un cajero debe ver su operacion de caja, no el cierre gerencial completo de otros cajeros o areas.

Consecuencia:

- La prueba de reportes falla si un usuario de caja con permiso de exportacion vuelve a recibir 200 en el PDF diario.
- Los PDFs de rango mantienen el camino existente de scoping por `cash_session_id` para usuarios no gerenciales.

### 2026-06-01 - E2E mockeado cubre branding publico

Decision:

- El flujo E2E mockeado intercepta `/api/settings/branding` con datos institucionales de Hospital San Isidro.

Motivo:

- La app consulta branding publico durante el arranque; sin ese mock, Playwright registraba un 500 de consola aunque el flujo principal estuviera cubierto.
- El gate E2E debe validar la experiencia offline sin depender de backend real ni modificar datos.

Consecuencia:

- `npm.cmd run e2e` vuelve a pasar sin errores de consola por branding.
- La validacion fisica y smoke contra servidor real siguen pendientes y separados de este gate mockeado.

### 2026-06-01 - Servicios nuevos siempre vinculados a area

Decision:

- Todo servicio creado desde la API debe declarar `area_id` para que los reportes por area no acumulen ingresos sin fuente institucional.
- El formulario de catalogo muestra y envia area; el asistente inicial de catalogo valida areas existentes antes de importar servicios.

Motivo:

- Administracion necesita ingresos por area confiables. Un servicio nuevo sin area puede terminar como ingreso "sin area" aunque la factura y el cobro sean correctos.
- La fuente de verdad debe estar en validacion de servidor y no depender de memoria humana al cargar catalogo.

Consecuencia:

- Las pruebas de catalogo fallan si la API permite crear servicios sin area.
- Los snapshots historicos de facturas conservan el area emitida y no se recalculan por cambios futuros de catalogo.

### 2026-06-01 - Evidencia fisica de recibos incluye todos los formatos

Decision:

- Las guias operativas, plantilla de evidencia, ayuda en la app y mensajes de handoff deben pedir validacion fisica de media carta, carta, A5, 80mm y 58mm.
- La plantilla `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md` incluye campos obligatorios `80mm result` y `58mm result`, coherentes con el preflight y `/api/system/status`.

Motivo:

- El sistema no debe reactivar instrucciones de ticket de rollo como formatos visibles.
- El preflight final debe recibir evidencia completa en el mismo contrato que usa la UI y la configuracion fiscal.

Consecuencia:

- El handoff no puede cerrar impresora fisica si faltan muestras reales de 80mm y 58mm.
- La pantalla de Ayuda tambien indica los cinco formatos para evitar que soporte y caja trabajen con una lista incompleta.

### 2026-06-01 - Politica de contrasenas alineada entre UI y API

Decision:

- La pantalla de usuarios valida contrasenas temporales con la misma regla publica que Laravel: minimo 10 caracteres, con letras y numeros.
- La regla aplica tanto al alta de usuarios como al restablecimiento administrativo de clave.

Motivo:

- El backend ya rechaza claves que no cumplen `Password::min(10)->letters()->numbers()`.
- La UI no debe prometer "minimo 6 caracteres", porque eso genera errores tardios y confusos para administracion.

Consecuencia:

- Las pruebas de `UsersView` fallan si el frontend vuelve a aceptar contrasenas sin numero o con menos de 10 caracteres.
- Laravel sigue siendo la fuente final de seguridad; el frontend solo anticipa el rechazo con un mensaje claro.

### 2026-06-01 - Retencion de backups conserva registros inseguros

Decision:

- La poda automatica solo elimina registros `success` antiguos cuando la ruta registrada es local y segura bajo `backups/`.
- Si un registro antiguo apunta fuera de `backups/`, usa `..` o no pertenece al disco local, el registro no se elimina; queda auditado como `backup.prune_skipped`.

Motivo:

- Un registro de backup con ruta insegura puede indicar corrupcion manual, importacion incorrecta o manipulacion; borrarlo durante retencion ocultaria evidencia operativa.
- La retencion debe liberar archivos seguros y antiguos sin perder trazabilidad de casos anormales.

Consecuencia:

- `BackupWorkflowTest` falla si la poda vuelve a borrar registros sospechosos.
- Soporte puede investigar registros omitidos sin que el proceso automatico toque rutas fuera del contenedor seguro de backups.

### 2026-06-01 - Guard de release verifica checksums reales

Decision:

- `scripts/assert_offline_release_clean.ps1` recalcula el SHA256 de cada imagen `.tar` y exige que coincida con su sidecar `.sha256` y con `checksums.sha256`.
- El guard bloquea archivos `.env` de produccion o variantes secretas, permitiendo solo ejemplos como `.env.example`, `.env.*.example`, `.env.sample` o `.env.dist`.

Motivo:

- Un artefacto offline puede tener archivos de imagen cambiados despues de generar el manifest; revisar solo nombres no prueba integridad.
- El paquete de produccion no debe incluir secretos aunque el nombre no sea exactamente `.env`.

Consecuencia:

- El handoff de release falla si un `.tar` cambia sin regenerar checksums.
- La validacion de 13G cubre caso positivo, checksum roto y `.env.production` con artefactos temporales locales.

### 2026-06-01 - Contrasena inicial de admin no viaja por argumentos CLI

Decision:

- El comando `auth:create-initial-admin` acepta la contrasena temporal desde `HOSPITAL_INITIAL_ADMIN_PASSWORD`.
- El instalador LAN captura la contrasena con entrada oculta, la pasa por entorno temporal al comando y limpia la variable al terminar.
- La contrasena temporal inicial debe cumplir el minimo institucional: 10 caracteres, con letras y numeros.
- `--password` queda disponible solo como compatibilidad tecnica, pero el instalador no lo usa.

Motivo:

- Pasar la contrasena por argumento puede exponerla en historial, logs o listas de procesos durante una instalacion real.
- La credencial inicial es sensible aunque obligue cambio al primer ingreso.

Consecuencia:

- `InitialAdminCommandTest` falla si el comando deja de aceptar la variable de entorno o permite crear admin sin una fuente de contrasena.
- `InitialAdminCommandTest` tambien falla si el comando vuelve a aceptar una contrasena temporal debil.
- El self-test del instalador usa placeholders explicitos y no cadenas que parezcan secretos reales.

### 2026-06-01 - Instalador production no ejecuta DatabaseSeeder completo

Decision:

- El instalador LAN ejecuta migraciones y luego siembra explicitamente `RolesAndPermissionsSeeder` y `ServiceCatalogSeeder`.
- No usa `php artisan migrate --force --seed` en el camino production bare-metal.

Motivo:

- `DatabaseSeeder` incluye `DevelopmentValidationSeeder` para `local/testing`; aunque ese seeder tiene guardas de entorno, produccion no debe depender de que una semilla de validacion se omita correctamente.
- El camino Docker production ya usaba seeders explicitos; bare-metal debe comportarse igual.

Consecuencia:

- Roles/permisos y catalogo inicial siguen siendo reproducibles en production.
- Usuarios de validacion y configuracion fiscal de demo no se ejecutan desde el instalador production.

### 2026-06-01 - Instalador oculta credenciales de base de datos

Decision:

- El instalador LAN usa `Read-SecretText` para capturar contrasenas sensibles con `Read-Host -AsSecureString`.
- La contrasena de MySQL/MariaDB y la contrasena temporal del admin se capturan sin eco visible en consola.

Motivo:

- Una instalacion hospitalaria puede ejecutarse en una PC compartida o con personal alrededor; las contrasenas no deben mostrarse mientras se escriben.
- El instalador ya limpia variables temporales despues de crear la base y el admin.

Consecuencia:

- El self-test del instalador debe seguir pasando despues de cambios de parsing/funciones.
- Futuras credenciales interactivas del instalador deben usar el helper de entrada oculta.

### 2026-06-01 - Lectura fiscal completa exige permiso explicito

Decision:

- `GET /api/settings/fiscal` exige `settings.fiscal.view` ademas de sesion activa y contrasena cambiada.
- `GET /api/settings/branding` se mantiene publico y limitado a campos institucionales necesarios para login/branding.

Motivo:

- La configuracion fiscal completa contiene campos operativos e internos que no deben quedar disponibles para cualquier usuario autenticado.
- El endpoint publico de branding cubre la necesidad de la pantalla de acceso sin exponer RTN, opciones de caja, scanner o configuracion fiscal completa.

Consecuencia:

- `FiscalSettingsTest` falla si un rol sin `settings.fiscal.view`, como cajero, vuelve a leer `/api/settings/fiscal`.
- Supervisores/admins conservan lectura segun la matriz de permisos.

### 2026-06-01 - Operaciones financieras usan alcance operativo de factura

Decision:

- Cobros, lectura de pagos, reversion de pagos y anulacion de facturas usan `InvoiceAccess::authorizeOperationalAccess`.
- El alcance operativo permite operar una factura propia del dia o cualquier factura solo con `invoices.operate_any`.
- Permisos historicos/de lectura como `reports.managerial.view` o `receipts.reprint_any` no otorgan por si solos capacidad de cobro, reversion o anulacion.

Motivo:

- Ver reportes o reimprimir facturas historicas no debe equivaler a operar financieramente facturas de otros cajeros.
- La matriz separa lectura historica de acciones criticas sobre caja/factura.

Consecuencia:

- Las pruebas fallan si `reports.managerial.view` o `receipts.reprint_any` vuelven a permitir pagos o anulaciones de facturas fuera del alcance operativo.
- Usuarios con `invoices.void` tambien necesitan operar su factura propia del dia o tener `invoices.operate_any` para anular facturas ajenas/antiguas.

### 2026-06-01 - Ingresos usan hechos financieros en centavos

Decision:

- `IncomeReportService` usa `FinancialFactsService` como fuente de verdad para facturado, cobrado, pendiente, parcial, anulado, cantidad de pagos y metodos de pago.
- `invoice_count` en ingresos conserva su contrato historico: cuenta facturas con pagos publicados en el periodo/filtro, no todas las facturas emitidas.
- `FinancialFactsService` calcula cobros desde `payments.amount_cents`, incluyendo prorrateo por categoria o area.
- El decimal `payments.amount` queda como representacion humana/persistida, no como fuente aritmetica de reportes.

Motivo:

- Los reportes administrativos no deben mezclar agregacion SQL en centavos con bucles PHP basados en floats.
- `amount_cents` evita deriva de redondeo y hace verificable el prorrateo por snapshots de items.

Consecuencia:

- `ReportsTest` falla si el reporte de ingresos vuelve a tomar el decimal `payments.amount` como fuente de cobro.
- Los reportes diarios, mensuales e ingresos comparten la misma semantica financiera.

### 2026-06-01 - Produccion protege env variants y healthcheck de worker

Decision:

- `.gitignore` bloquea variantes locales/production de `.env` para reducir riesgo de secretos en Git.
- `docker-compose.prod.yml` agrega healthcheck al servicio `queue-worker` para validar que Laravel pueda abrir conexion de base de datos.
- Las guias de instalacion nombran `php artisan key:generate` como comando explicito para crear `APP_KEY`.

Motivo:

- En produccion offline las credenciales reales se escriben en archivos `.env` fuera del repositorio; variantes como `.env.production` son igual de sensibles que `.env`.
- El worker continuo de backups es un bloqueante de `PRODUCTION_READY`; Docker debe exponer una senal basica de salud del proceso conectado a DB.
- Un runbook no tecnico debe decir el comando exacto para generar la llave, no solo la intencion.

Consecuencia:

- El paquete de produccion sigue dependiendo de evidencias reales para declararse listo, pero el compose entrega una senal operativa adicional para backups.
- Futuras variantes de entorno con secretos deben permanecer ignoradas salvo archivos ejemplo o sample aprobados.

### 2026-06-02 - Orden operativo de formatos de recibo institucional

Decision:

- Las instrucciones y selectores deben presentar los formatos como media carta, carta, A5, 80mm y 58mm.
- Los valores heredados 80mm/58mm se normalizan a media carta y no reemplazan los formatos de pagina.
- Los textos de entrega deben mencionar media carta/carta/A5 como formatos institucionales visibles.

Motivo:

- La validacion fisica pendiente debe cubrir los cinco formatos, y el orden debe coincidir con la instruccion operativa esperada por el hospital.
- Presentar formatos de rollo como recibo institucional confunde el alcance de validacion.

Consecuencia:

- Las pruebas del helper de papel fallan si el selector vuelve a ordenar termico antes de carta/A5.
- Las guias operativas deben listar siempre media carta, carta, A5, 80mm y 58mm cuando hablen de prueba o seleccion de recibo.

### 2026-06-02 - Orden operativo invertido para recibo institucional

Decision:

- El selector y las pruebas de evidencia fisica empiezan por media carta, siguen con carta y despues A5.
- 80mm y 58mm permanecen al final como formatos termicos soportados, no como primera opcion operativa.
- El valor por defecto sigue siendo media carta para mantener compatibilidad con configuraciones existentes.

Motivo:

- La aclaracion operativa indica que el orden anterior estaba al reves.
- Cambiar solo el orden evita migraciones y no altera recibos historicos ni validacion de backend.

Consecuencia:

- Los operadores ven primero media carta/carta/A5 al seleccionar o probar recibos.
- La prueba unitaria del helper falla si A5, carta y media carta dejan de aparecer primero en ese orden.

### 2026-06-02 - Crear usuarios se muestra solo con permiso explicito

Decision:

- La vista de administracion de usuarios recibe `canCreateUsers` desde la sesion y oculta la accion "Crear usuario" cuando falta `users.create`.
- `users.view` permite entrar a la lista, pero no debe sugerir una accion de creacion que el backend rechazara.
- El backend sigue siendo la defensa real; este cambio solo alinea la UX con permisos de menor privilegio.

Motivo:

- Operadores con permiso de lectura de usuarios necesitan consultar la lista sin ver acciones que no pueden ejecutar.
- Ocultar botones reduce errores operativos y no debe sustituir las validaciones del API.

Consecuencia:

- `UsersView.test.tsx` falla si el boton de crear vuelve a mostrarse sin `users.create`.
- Cualquier nueva accion administrativa debe recibir un permiso UI explicito, separado del permiso de lectura.

### 2026-06-02 - Errores de red API guardan detalle sanitizado

Decision:

- Los errores de red del cliente API usan el mensaje operador de servidor LAN no disponible y agregan solo detalle sanitizado del navegador.
- La sanitizacion reutiliza `safeClientMessage` para remover secretos, tokens, rutas locales y credenciales antes de guardar evidencia local.
- La misma semantica aplica a CSRF, requests normales y descargas.

Motivo:

- Soporte necesita distinguir fallas como navegador sin conexion, servidor apagado o proxy caido, pero el cajero no debe ver ni almacenar datos sensibles crudos.
- El cambio previo de propagar `err.message` directamente podia filtrar texto tecnico o secretos en `userSafeErrorMessage`.

Consecuencia:

- `base.test.ts` falla si un error de red vuelve a guardar `DB_PASSWORD`, `token` o secretos similares.
- Los mensajes de red siguen siendo accionables para el operador y utiles para soporte local.

### 2026-06-02 - Previsualizacion de factura calcula ISV en centavos

Decision:

- La previsualizacion local de nueva factura calcula subtotal, ISV y total estimado en centavos usando `default_tax_rate` y la bandera `taxable` de cada servicio.
- La regla visual de eritropoyetina gratis por receta de dialisis aplica precio cero tambien en el estimado.
- El backend sigue siendo la unica fuente de verdad al emitir; la UI solo anticipa el total para el cajero.

Motivo:

- El carrito mostraba un total estimado sin ISV para servicios gravados, aunque el backend devolvia una factura con impuesto.
- Una caja hospitalaria necesita que el cajero vea un estimado coherente antes de emitir/cobrar, sin depender de floats.

Consecuencia:

- `NewInvoiceView.test.tsx` falla si el flujo de cobro deja de mostrar el total estimado con ISV antes de emitir.
- Cualquier diferencia final sigue resolviendose con la respuesta del backend emitida.

### 2026-06-02 - Restore Windows compatible con PowerShell 5.1

Decision:

- `scripts/restore_hospital_windows.ps1` no usa operadores exclusivos de PowerShell 7 y resuelve `backend\.env` relativo al repositorio.
- `-UseExistingEnv` toma credenciales del `.env`, pero restaura en `-TargetDatabase`, no en la base activa del `.env`.
- El script agrega `-SelfTest` no destructivo y valida que el destino sea una base descartable con nombre seguro.

Motivo:

- Un servidor Windows hospitalario puede ejecutar Windows PowerShell 5.1, donde `??` no existe.
- Restore es destructivo sobre el destino; el helper debe impedir nombres productivos, bases de sistema y formatos no esperados antes de buscar cliente MySQL.

Consecuencia:

- Soporte puede ejecutar `restore_hospital_windows.ps1 -SelfTest` sin tocar datos.
- Restore real sigue pendiente hasta ejecutarse contra una base descartable y documentarse en `qa/FINAL_RESTORE_PROOF.md`.

### 2026-06-02 - CORS de Docker production limitado al puerto publicado

Decision:

- `docker-compose.prod.yml` exige `SERVER_IP` tambien en el contenedor backend.
- `CORS_ALLOWED_ORIGINS` en backend y worker usa solo `http://${SERVER_IP}:${APP_PORT:-8000}`.
- `SANCTUM_STATEFUL_DOMAINS` conserva el host LAN y el host con puerto publicado.

Motivo:

- Si `APP_PORT` cambia, permitir siempre `:8000` deja un origen LAN innecesario.
- Produccion debe aceptar solo el origen desde el que se publicara la app.

Consecuencia:

- El compose prod renderiza CORS con `:8000` por defecto y con el puerto personalizado cuando `APP_PORT` se define.
- Si el hospital usa otro nombre LAN ademas de IP, debe configurarse explicitamente en una fase final aprobada.

### 2026-06-02 - Rutas React secundarias cargan bajo demanda

Decision:

- `AppRoutes` usa `React.lazy` y `Suspense` para pantallas secundarias como reportes, catalogo, respaldos, usuarios, ayuda y configuracion.
- Caja y nueva factura permanecen en el bundle principal porque tambien se abren como modales rapidos del flujo operativo.

Motivo:

- El build de Vite generaba un chunk principal mayor a 500 kB.
- En red LAN y equipos de caja modestos conviene que las pantallas no activas no carguen durante el primer acceso.

Consecuencia:

- El chunk principal baja de 532.88 kB a 361.82 kB minificado y desaparece la advertencia de Vite.
- Las pruebas de rutas deben esperar la carga lazy cuando validan una pantalla secundaria.

### 2026-06-02 - Validacion temprana y throttling en mutaciones financieras

Decision:

- `StoreInvoiceRequest` valida que `service_id` exista antes de entrar al servicio de emision.
- La cantidad de factura conserva formato decimal de hasta dos posiciones y minimo `0.01`.
- Pago, anulacion de pago y anulacion de factura tienen throttling especifico ademas del throttle autenticado general.

Motivo:

- Facturacion y caja son superficies mutantes de alto impacto y deben fallar temprano con errores de validacion claros.
- Reintentos excesivos sobre pago/anulacion pueden generar presion operativa o abuso aun cuando las transacciones de dominio sean seguras.

Consecuencia:

- Cantidades `0` o negativas siguen rechazadas por Form Request.
- Operaciones financieras sensibles tienen limites de frecuencia mas estrictos sin cambiar permisos ni transacciones.

### 2026-06-02 - Motivos de anulacion no pueden ser solo espacios

Decision:

- `VoidInvoiceAction` y `VoidPaymentAction` recortan el motivo antes de mutar datos.
- Si el motivo queda vacio, la accion devuelve un error de validacion aunque la request haya recibido un string.

Motivo:

- Anulaciones y reversos son eventos auditables; aceptar `"   "` deja una auditoria formalmente completa pero operacionalmente inutil.
- La regla debe vivir tambien en la capa de accion porque estas mutaciones pueden invocarse desde controladores o helpers internos.

Consecuencia:

- Los tests de factura y pago cubren motivo vacio y motivo compuesto solo por espacios.
- Los motivos validos se guardan ya recortados en factura, pago, movimiento de caja y auditoria.

### 2026-06-02 - Composer lock alineado y advisories Symfony cerrados

Decision:

- `composer.lock` se refresca para coincidir con `composer.json`.
- Se aplican parches compatibles para Symfony, Guzzle y polyfills dentro de la misma linea permitida por Laravel 12.

Motivo:

- El build del paquete offline avisaba que el lock no estaba actualizado.
- `composer audit` reportaba advisories en paquetes Symfony, incluyendo una vulnerabilidad alta en `symfony/mime`.

Consecuencia:

- `composer validate` pasa dentro del contenedor backend.
- `composer audit` queda sin advisories conocidos en el lock actual.
- El paquete offline debe regenerarse despues de este commit para incluir el lock corregido.

### 2026-06-02 - Sin indice parcial SQL para secuencia fiscal activa

Decision:

- No se usa `CREATE UNIQUE INDEX ... WHERE active = 1` para `fiscal_sequences`.
- La unicidad de una secuencia activa por tipo de documento sigue apoyandose en `active_document_type`, columna nullable con indice unico ya existente.

Motivo:

- MariaDB/MySQL no aceptan el indice parcial con `WHERE active = 1`; una instalacion desde cero fallaria al ejecutar migraciones.
- `active_document_type` ya modela el mismo contrato de forma portable para MySQL/MariaDB: las secuencias inactivas quedan en `NULL` y las activas guardan el `document_type` unico.

Consecuencia:

- Las migraciones desde cero deben pasar contra MariaDB local.
- Cualquier endurecimiento adicional de secuencias fiscales debe respetar compatibilidad MySQL/MariaDB offline LAN.

### 2026-06-02 - Backups create/download usan Form Requests

Decision:

- `POST /api/backups` usa `StoreBackupRequest`.
- `GET /api/backups/{backupLog}/download` usa `DownloadBackupRequest`.
- La validacion fisica del archivo descargable sigue en el controlador porque depende del registro, disco local y ruta real.

Motivo:

- La regla del proyecto pide Form Requests para validacion/autorizacion de endpoints.
- Crear y descargar respaldos son operaciones sensibles; el permiso debe quedar en una clase dedicada y testeable, no como `Request` generico en el controlador.

Consecuencia:

- `BackupController` conserva las defensas de path traversal y auditoria de descarga.
- Usuarios sin permisos siguen recibiendo 403 en listado, creacion y descarga.

### 2026-06-02 - Gestion de usuarios usa Form Requests tambien para listar y desactivar

Decision:

- `GET /api/admin/users` usa `IndexUserRequest`.
- `POST /api/admin/users/{user}/toggle-active` usa `ToggleUserActiveRequest`.
- La regla que impide desactivar el propio usuario queda en validacion del request.

Motivo:

- Listar usuarios y cambiar estado activo son operaciones administrativas sensibles.
- Mantener permisos y reglas de borde en Form Requests deja el controlador mas delgado y consistente con crear, editar y resetear contrasena.

Consecuencia:

- Cajeros siguen recibiendo 403 al listar o desactivar usuarios.
- Admin puede desactivar otro usuario, pero recibe 422 si intenta desactivarse a si mismo.

### 2026-06-02 - Lectura de categorias valida filtros con Form Request

Decision:

- `GET /api/categories` usa `IndexCategoryRequest`.
- El filtro `active` se valida como booleano antes de consultar.
- La autorizacion `catalog.view` queda fuera del controlador.

Motivo:

- El catalogo es fuente operativa para facturacion y debe rechazar filtros ambiguos antes de construir consultas.
- Mantener lectura, creacion y actualizacion de categorias bajo Form Requests reduce diferencias entre endpoints del mismo modulo.

Consecuencia:

- Usuarios sin `catalog.view` reciben 403 al listar categorias.
- `active=0` sigue permitiendo consultar categorias inactivas a usuarios autorizados.
- Valores no booleanos para `active` devuelven 422.

### 2026-06-02 - Lectura de areas valida filtros con Form Request

Decision:

- `GET /api/areas` usa `IndexAreaRequest`.
- La autorizacion permite `catalog.view` o `reports.managerial.view`.
- El filtro `active` se valida como booleano antes de consultar.

Motivo:

- Las areas alimentan tanto catalogo como reportes gerenciales; ambos permisos son validos, pero deben declararse fuera del controlador.
- Rechazar filtros no booleanos evita consultas ambiguas en un endpoint compartido por caja, catalogo y reportes.

Consecuencia:

- Usuarios sin permisos de catalogo ni reportes siguen recibiendo 403.
- Usuarios autorizados pueden consultar areas activas o inactivas con filtros booleanos.
- Valores invalidos de `active` devuelven 422.

### 2026-06-02 - Listado de secuencias fiscales usa Form Request

Decision:

- `GET /api/fiscal-sequences` usa `IndexFiscalSequenceRequest`.
- La autorizacion `settings.fiscal.view` queda fuera del controlador.

Motivo:

- Las secuencias fiscales contienen CAI, rango autorizado y correlativo; su lectura debe tratarse como operacion fiscal sensible.
- Create/update ya usaban Form Requests, y el listado queda alineado con el mismo limite de permisos.

Consecuencia:

- Supervisores/admin con permiso fiscal de lectura pueden listar secuencias.
- Cajeros sin permiso fiscal reciben 403.

### 2026-06-02 - Desgloses con alcance de cobro usan fecha de pago

Decision:

- Reportes por categoria, area y servicio mantienen fecha de emision cuando muestran facturacion.
- Cuando el filtro usa metodo, caja o cajero, el desglose usa el rango de pagos y asigna el cobro proporcionalmente por snapshots de `invoice_items`.

Motivo:

- Un cobro de hoy sobre una factura emitida antes del rango debe aparecer en el resumen cobrado de hoy y tambien en el desglose que explica de que area/servicio vino ese cobro.
- Mezclar fecha de pago en el resumen y fecha de emision en el desglose deja cifras correctas pero inexplicables para administracion.

Consecuencia:

- Las pruebas de reportes fallan si un cobro en rango desaparece de categoria, area o servicio por haber sido facturado fuera del rango.
- Los reportes puramente facturados siguen usando fecha de emision y no cambian su lectura historica.

### 2026-06-02 - Estado operativo usa Form Request

Decision:

- `GET /api/system/status` usa `ShowSystemStatusRequest`.
- La autorizacion `system.status.view` queda fuera del controlador.

Motivo:

- El estado operativo expone preparacion de entorno, backups, LAN y pruebas fisicas; su lectura debe seguir el mismo patron de autorizacion que backups, usuarios y configuracion fiscal.
- Mantener controladores delgados reduce autorizaciones dispersas y facilita pruebas de permisos.

Consecuencia:

- Usuarios sin `system.status.view` siguen recibiendo 403.
- El controlador queda enfocado en construir el payload operativo.

### 2026-06-02 - Lectura fiscal usa Form Request

Decision:

- `GET /api/settings/fiscal` usa `ShowFiscalSettingsRequest`.
- La autorizacion `settings.fiscal.view` queda fuera del controlador.

Motivo:

- La configuracion fiscal completa incluye datos institucionales y opciones operativas sensibles; su lectura debe seguir el mismo patron que actualizacion y logo.
- La pantalla publica conserva `/api/settings/branding` como respuesta estrecha sin CAI, RTN interno ni opciones operativas.

Consecuencia:

- Cajeros y usuarios sin permiso fiscal siguen recibiendo 403 en la configuracion completa.
- Login/branding publico no cambia.

### 2026-06-02 - Caja actual usa Form Request

Decision:

- `GET /api/cash-sessions/current` usa `CurrentCashSessionRequest`.
- La autorizacion `cash.view` queda fuera del controlador.

Motivo:

- La caja actual alimenta el estado operativo del cajero y la conciliacion visible; su lectura debe seguir el mismo patron de requests autorizados que abrir, cerrar y listar caja.
- Evitar `abort(403)` disperso facilita revisar permisos de caja por endpoint.

Consecuencia:

- Usuarios sin `cash.view` siguen recibiendo 403.
- La respuesta de caja actual y reconciliacion no cambia.

### 2026-06-02 - Guardas de release validan limites de subida

Decision:

- `scripts/assert_production_docker_sources.ps1` valida que `nginx/default.conf` tenga `client_max_body_size` y que no exceda `upload_max_filesize` ni `post_max_size` de `backend/Dockerfile.prod`.
- `scripts/assert_offline_release_clean.ps1` valida que `docker-compose.prod.yml`, `backend/Dockerfile.prod` y `nginx/default.conf` dentro de `offline-release` coincidan con la fuente versionada.

Motivo:

- El paquete offline no debe aceptar archivos que PHP rechazara despues ni entregar una configuracion nginx stale distinta al codigo auditado.
- Un operador no tecnico necesita un guard ejecutable que falle antes del handoff, no una nota manual escondida en documentacion.

Consecuencia:

- Si se cambia nginx, Dockerfile o compose productivo, se debe regenerar `offline-release` antes de entrega.
- El release queda bloqueado si el limite de nginx vuelve a quedar por encima de PHP o si el artefacto copiado esta desactualizado.

### 2026-06-01 - Production config defaults hardened (F1)

Decision:

- config/database.php deja de tener env('DB_CONNECTION', 'sqlite') y pasa a env('DB_CONNECTION', 'mysql'). Los queue drivers (database, beanstalkd, sqs, redis) declaran fter_commit => true.

Motivo:

- En produccion, un DB_CONNECTION no exportado en .env caia silenciosamente a SQLite. Esto contradice AGENTS.md ("MySQL/MariaDB local en servidor LAN") y permitia que el sistema arrancara con una BD en archivo, rompiendo concurrencia, lock de correlativo fiscal y consistencia de caja.
- fter_commit: false permitia que un job despachado dentro de una transaccion quedara huerfano si la transaccion hacia rollback. Laravel 11+ recomienda 	rue por defecto.

Consecuencia:

- Tests phpunit con RefreshDatabase siguen pasando porque phpunit.xml fuerza DB_CONNECTION=sqlite con force="true".
- Tests phpunit siguen ejecutando jobs sincronamente porque phpunit.xml fuerza QUEUE_CONNECTION=sync.
- Operadores deben exportar DB_CONNECTION en .env antes de la primera corrida.
- CloseCashSessionAction mantiene su DB::afterCommit explicito; con el flag global, la llamada se vuelve redundante pero no rompe.

### 2026-06-01 - PDF XSS hardening (F2)

Decision:

- PdfExportService introduce un helper e(mixed): string publico que aplica htmlspecialchars(, ENT_QUOTES | ENT_HTML5, 'UTF-8'). Toda cadena controlada por el usuario (nombre del hospital, RTN, fechas, metodo, estado, contadores) se envuelve con e() antes de interpolarse en el HTML del PDF.
- Las funciones publicas generateDailyClosurePdf y generateRangeClosurePdf delegan en buildDailyClosureHtml y buildRangeClosureHtml para que el HTML sea testeable sin decodificar el binario del PDF.

Motivo:

- Un atacante con permisos de admin (puede editar FiscalSetting) podia inyectar <script>, <img onerror=...> o <svg/onload=...> en el nombre del hospital o RTN. El payload se ejecutaba en el visor de PDF del operador segun la configuracion.
- DomPDF no escapa HTML por defecto; es responsabilidad del productor.

Consecuencia:

- 5 vitest cases cubren payloads XSS conocidos y verifican que la salida contiene &lt;script&gt;, &lt;img, &lt;svg/ en lugar del HTML literal.
- Si en el futuro se quiere permitir HTML limitado (negrita, saltos), hay que cambiar e() a una libreria con allowlist (DOMPurifier) o un parser HTML. Por ahora, escape total es lo correcto.

### 2026-06-01 - Dinero en centavos (F3)

Decision:

- payments a�ade columna mount_cents bigInteger (migration 2026_06_01_000001).
- RegisterPaymentAction, VoidPaymentAction, BuildCashReconciliationAction y los reportes con ROUND(payments.amount * 100) se cambian a SUM(payments.amount_cents).

Motivo:

- En MySQL/MariaDB, DECIMAL(12,2) * 100 se hace en punto flotante. Para valores grandes o agregaciones largas, se acumula drift. intdiv((amount * 100) + 50, 100) (round-half-up) en cents es la forma canonica de evitarlo.
- AGENTS.md dice: "Evitar logica de dinero en floats; usar enteros en centavos o decimal(12,2) con cuidado". Con mount_cents agregado, el camino critico (pagos, anulacion, reconciliacion) cumple esa regla.

Consecuencia:

- invoices y invoice_items aun usan decimal(12,2) sin columna cents. Sus ROUND(total * 100) y ROUND(line_total * 100) en report services quedan. Migrarlos requiere a�adir *_cents a las dos tablas y backfill, que es scope de una iteracion futura.
- Nueva regression test PaymentCentsSqlGuardTest parsea el codigo fuente de los report services y falla si alguien reintroduce ROUND(payments.amount * 100).

### 2026-06-01 - Autorizacion solo via Form Requests (F4)

Decision:

- Se elimina el directorio backend/app/Policies/ con sus 5 clases (InvoicePolicy, PaymentPolicy, CashRegisterSessionPolicy, FiscalSettingPolicy, BackupPolicy). Nunca fueron registradas con Gate::policy() ni invocadas via $user->can('action', ).
- La autorizacion se queda como esta: Form Request::authorize() y string permissions en los actions y controllers.

Motivo:

- Las policies eran codigo muerto que confunde a quien lee por primera vez.
- CashRegisterSessionPolicy::viewAny y ::create retornaban 	rue sin chequeos. Si se hubiera activado el auto-discovery de Laravel o un Gate::policy() futuro, habria sido una escalacion de privilegios.
- La estrategia actual (Form Request + $user->can('perm')) es consistente y esta cubierta por tests.

Consecuencia:

- Nueva test AuthorizationStrategyTest parsea el filesystem y AppServiceProvider para detectar regresiones (re-introducir pp/Policies o Gate::policy() sin wiring).
- Si en el futuro se quieren policies por modelo, hay que registrarlas explicitamente con Gate::policy() en AppServiceProvider::boot().

### 2026-06-01 - Migracion amount_cents con driver-guard (F5)

Decision:

- 2026_06_01_000001_add_amount_cents_to_payments_table.php se envuelve en Schema::hasColumn para re-entry safety, y la logica CAST(amount * 100 AS SIGNED) se restringe a drivers mysql|mariadb. En otros drivers (sqlite de tests) se hace backfill en PHP con round((float) * 100) y chunkById(500).

Motivo:

- CAST(... AS SIGNED) es MySQL-only. Los tests RefreshDatabase contra SQLite in-memory fallarian con
o such function: SIGNED.
- chunkById evita que el backfill de la tabla payments cargue millones de filas en memoria en SQLite.
- doctrine/dbal ya no es necesario en Laravel 11+ para ->change(). Mantenerlo fuera de composer.json ahorra ~5MB.

Consecuencia:

- AmountCentsMigrationTest (PHPUnit) verifica que la columna existe despues de RefreshDatabase y que el codigo fuente contiene el guard del driver.
- La migracion es idempotente: se puede re-ejecutar sin error despues de un fallo parcial.

### 2026-06-01 - Helpers de money/quantity centralizados (F8)

Decision:

- Nuevo frontend/src/lib/moneyCents.ts con parseCents, parsePositiveCents, formatCents, formatLempirasFromCents, parseQuantityUnits, formatQuantity. 8 vitest cases.

Motivo:

- parseCents, formatCents, parseQuantityUnits estaban duplicados en NewInvoiceView, InvoiceCart, PaymentModal, CashBoxView, OpenSessionForm. Cada copia tenia peque�as variaciones de regex/precision, lo que hacia que el redondeo de UI difiriera entre vistas.
- Money en el backend (PHP) ya define la politica de redondeo (HALF_AWAY_FROM_ZERO). Los helpers del frontend reflejan esa misma politica.

Consecuencia:

- Por ahora, las vistas siguen con su codigo local. La migracion de cada vista a usar moneyCents es scope de v1.1.0.
- Las pruebas (8 vitest cases) garantizan que el helper no introduce drift.

### 2026-06-01 - Backend y nginx con healthchecks (F11)

Decision:

- docker-compose.prod.yml a�ade healthcheck al backend (DB::connection()->getPdo() via tinker) y a nginx (wget http://localhost/up).
- nginx cambia de depender de backend: service_started a backend: service_healthy, garantizando que el paso cp /var/www/html/public del entrypoint haya terminado antes de que nginx intente servir.
- client_max_body_size de nginx baja de 100M a 32M para coincidir con upload_max_filesize=32M y post_max_size=32M de backend/Dockerfile.prod.

Motivo:

- Sin healthchecks, un PHP-FPM trabado o un nginx sirviendo 404 (porque el cp aun no termino) pasaban desapercibidos.
- El limite de 100M era enga�oso: nginx aceptaba el body pero PHP lo rechazaba con un 413/500 silencioso.

Consecuencia:

- Operadores pueden detectar caidas via docker compose ps (muestra healthy/unhealthy).
- Si en el futuro se sube el limite PHP, hay que acordarse de subir client_max_body_size tambien (comentado en default.conf).
- offline-release/MANIFEST.txt (no commiteado, regenerado por pipeline) registra la nueva configuracion.

### 2026-06-02 - Reparacion segura detecta paquete offline Docker

Decision:

- `scripts/repair_hospital_system.ps1` y `scripts/start_hospital_services.ps1` detectan si corren en desarrollo Docker o en paquete offline productivo.
- En desarrollo solicitan `backend`, `frontend` y `mysql`; en paquete offline productivo solicitan `backend`, `nginx`, `mysql` y `queue-worker` usando `docker-compose.prod.yml` y `.env` raiz si existe.
- Ambos scripts tienen modo `-WhatIfOnly` para validar modo, URL y servicios sin levantar Docker ni modificar contenedores.
- `scripts/assert_offline_release_clean.ps1` compara scripts operativos criticos de soporte, arranque, diagnostico y backups dentro de `offline-release/scripts`.

Motivo:

- El paquete offline no tiene servicio `frontend`; la interfaz compilada la sirve `nginx`. Una reparacion que intente levantar `frontend` falla justo cuando el operador necesita recuperar caja.
- Soporte de primer nivel necesita un chequeo no invasivo antes de tocar servicios del servidor.
- Si cambia el script de reparacion segura o arranque manual, instalar una copia vieja deja al hospital sin recuperacion confiable cuando el sistema no abre.

Consecuencia:

- La reparacion segura sigue sin borrar datos, sin eliminar volumenes, sin ejecutar seeders y sin restaurar backups automaticamente.
- Las guias operativas indican validar `start_hospital_services.ps1 -WhatIfOnly` antes de levantar servicios manualmente.
- El release queda bloqueado si los scripts de soporte del paquete offline no coinciden con Git.


### 2026-06-02 - apiClient hardening con cache de CSRF y lista 422 completa

Decision:

- frontend/src/lib/api/base.ts cachea la respuesta de /sanctum/csrf-cookie durante 30 minutos para no disparar un round-trip en cada mutacion.
- 422 expone la lista completa de errores con etiquetas legibles (Items #2 (quantity): ..., patient name: ...) en lugar de truncar a tres mensajes.
- 423 Locked recibe un mensaje dedicado que pide esperar 15 minutos o pedir reactivacion al supervisor.
- Nuevo helper isPermissionDeniedError(error) para uso futuro en guards.
- Tests ampliados en base.test.ts cubren CSRF cache, lista 422, 423, 403, sanitizacion 5xx y los nuevos helpers.

Motivo:

- Cajeras con teclado y raton generan muchos requests de mutacion por minuto; un round-trip extra de CSRF por cada uno degrada la experiencia de caja sin agregar seguridad real porque Sanctum ya protege la cookie.
- 422 truncado obligaba a la cajera a corregir un error, reenviar, descubrir otro, reenviar: la lista completa acelera la correccion de formularios.
- El plan de Fase 17 introduce lockout por intentos fallidos; el cliente debe mostrar el mensaje correcto apenas el backend responda 423.

Consecuencia:

- La politica de cache obliga a resetCsrfCache() en tests para no contaminar el estado entre casos; exportado desde lib/api/index.ts.
- El bloqueo temporal se documenta como 423 (Locked) y no como 429 (Too Many Requests) porque el motivo es autenticacion, no throttling.
- formatValidationMessage reescribe snake_case a frases (patient_name -> patient name, items.0.quantity -> Items #1 (quantity)); cualquier consumidor que dependa del mensaje exacto debe pasar a error.validationErrors.

### 2026-06-02 - Reduccion de NewInvoiceView con reducer y math extraidos

Decision:

- NewInvoiceView.tsx (1020 lineas) se divide en state/types.ts, state/reducer.ts y state/posMath.ts para poder probar el reducer y los calculos fiscales sin renderizar React.
- El componente principal queda en ~733 lineas como orquestador; el resto vive en una sola capa de UI que reusa los hooks ya extraidos.
- Las funciones de dinero locales (parseCents, formatCents, isZeroMoney, computeSimpleEstimate) ahora envuelven frontend/src/lib/moneyCents.ts para alinear el preview con el backend.

Motivo:

- El CHANGELOG 1.0.0-rc.2 reconocio que NewInvoiceView era una deuda tecnica diferida a 1.1.0; el primer paso de la fase 7 la deja cubierta con dos suites vitest nuevas (19 casos totales) sin cambiar comportamiento visible.
- El reducer puro permite reproducir regresiones de carrito y Eritropoyetina en CI sin depender del DOM, lo cual baja la barrera para futuros cambios.
- Reusar moneyCents en posMath elimina el riesgo de que el preview de UI redondee distinto al backend.

Consecuencia:

- La fase 8 (wire moneyCents en vistas) puede migrar el resto de componentes sin tocar NewInvoiceView: la regla ya esta aplicada.
- El refactor esta incompleto (<200 lineas no alcanzado) pero los hooks extraidos cubren los caminos criticos; dividir la UI en sub-pasos queda para v1.1.0 si la UI se vuelve a expandir.
- Cualquier cambio de regla de negocio fiscal o de carrito debe vivir primero en state/posMath.ts o state/reducer.ts y luego en los tests correspondientes.

### 2026-06-02 - Listado de pagos usa Form Request

Decision:

- `GET /api/invoices/{invoice}/payments` usa `IndexPaymentRequest`.
- La autorizacion `payments.view` queda fuera del controlador.

Motivo:

- El listado de pagos expone caja, cajero, metodo y fechas de cobro; debe quedar bajo el mismo patron de autorizacion declarativa que crear y anular pagos.
- El acceso operativo a la factura sigue validandose con `InvoiceAccess`.

Consecuencia:

- Usuarios sin `payments.view` siguen recibiendo 403.
- Usuarios con permiso de pagos todavia necesitan alcance operativo sobre la factura.

### 2026-06-02 - Listado de servicios confia en IndexServiceRequest

Decision:

- `GET /api/services` elimina la comprobacion duplicada de `catalog.view` en el controlador.
- `IndexServiceRequest` queda como fuente unica de autorizacion y validacion de filtros.

Motivo:

- El request ya autoriza `catalog.view`; repetir la misma regla en el controlador dispersa permisos sin agregar seguridad.
- Mantener una sola fuente facilita revisar permisos de catalogo.

Consecuencia:

- Usuarios sin `catalog.view` siguen recibiendo 403.
- El controlador queda enfocado en construir la consulta y paginacion.

### 2026-06-02 - Lectura y anulacion de facturas usan Form Requests

Decision:

- `GET /api/invoices/{invoice}` usa `ShowInvoiceRequest` para autorizar `invoices.view`.
- `POST /api/invoices/{invoice}/void` confia en `VoidInvoiceRequest` para autorizar `invoices.void`.
- El alcance operativo/historico de la factura sigue validandose con `InvoiceAccess` desde el controlador.

Motivo:

- Facturas contienen paciente, caja, pagos y datos fiscales; los permisos base deben quedar declarados en requests.
- Separar permiso base de alcance por factura deja mas clara la revision de seguridad.

Consecuencia:

- Usuarios sin `invoices.view` o `invoices.void` siguen recibiendo 403.
- Usuarios con permiso base todavia deben cumplir alcance de factura antes de ver o modificar registros.

### 2026-06-02 - Exportacion Excel usa Form Request dedicado

Decision:

- `GET /api/reports/export` usa `ExportReportRequest`.
- `ExportReportRequest` conserva reglas de rango de `DateRangeReportRequest` y agrega `reports.export`.

Motivo:

- Exportar reportes genera archivos con informacion financiera; el permiso de exportacion debe estar en la capa de request, no mezclado en el controlador.
- La autorizacion base de vista gerencial o caja se mantiene en el request padre.

Consecuencia:

- Usuarios sin `reports.export` siguen recibiendo 403.
- Rango de fechas, alcance por caja y filtros mantienen la misma validacion.

### 2026-06-02 - PDF de reportes centraliza alcance en request

Decision:

- `PdfExportRequest` expone filtros autorizados para reportes de periodo.
- `ReportController@pdfExport` deja de repetir validaciones de permiso gerencial y propiedad de caja.

Motivo:

- La exportacion PDF contiene informacion financiera y su alcance debe resolverse junto con la autorizacion del request.
- Mantener el controlador delgado reduce diferencias entre PDF y Excel.

Consecuencia:

- Cierre diario PDF sigue limitado a usuarios gerenciales por `PdfExportRequest::authorize`.
- Usuarios de caja solo pueden exportar periodos con su propia `cash_session_id`.

### 2026-06-02 - Reporte de caja usa request de autorizacion dedicado

Decision:

- `GET /api/reports/cash-sessions/{cashSession}` usa `ShowCashSessionReportRequest`.
- La autorizacion combina permiso de reporte y propiedad de caja o permiso `cash.close_any`.

Motivo:

- La verificacion dependia del modelo de ruta y estaba repetida dentro del controlador.
- Centralizarla facilita auditar permisos de reportes financieros.

Consecuencia:

- Usuarios sin permiso de reporte reciben 403.
- Cajeros con permiso limitado solo pueden ver su propia caja; usuarios con `cash.close_any` conservan alcance amplio.

### 2026-06-02 - Reportes de rango resuelven filtros autorizados en request

Decision:

- `DateRangeReportRequest` expone `authorizedFilters()` para income, categorias, areas, servicios, operaciones y exportacion Excel.
- `ReportController` deja de mantener `scopedFilters()` privado.

Motivo:

- El alcance por caja o por usuario es parte de la autorizacion del request de reportes.
- Unificar la regla evita divergencias entre vistas y exportaciones.

Consecuencia:

- Usuarios con `cash.close_any` conservan filtros amplios.
- Usuarios sin ese permiso quedan limitados a su usuario y no pueden consultar cajas ajenas.

### 2026-06-02 - Detalle de factura valida alcance historico en request

Decision:

- `ShowInvoiceRequest` valida permiso `invoices.view` y alcance sobre la factura ligada por ruta.
- `InvoiceController@show` deja de ejecutar `abort_unless` para factura propia del dia.

Motivo:

- El detalle de factura expone pagos, caja, emisor y datos fiscales; su alcance debe resolverse en el Form Request.
- Reusar `InvoiceAccess` evita duplicar reglas entre listado y detalle.

Consecuencia:

- Usuarios con acceso historico mantienen alcance amplio.
- Cajeros sin acceso historico solo pueden ver facturas propias emitidas hoy.

### 2026-06-02 - Media carta de recibo se imprime horizontal

Decision:

- El recibo institucional `half_letter` usa `8.5in x 5.5in` en preview, print y `@page`.
- Los formatos carta, A5, 80mm y 58mm conservan sus dimensiones existentes.

Motivo:

- Media carta operativa corresponde a media hoja carta horizontal; `5.5in x 8.5in` invertia la orientacion esperada.
- La prueba frontend fija la regla para evitar regresiones.

Consecuencia:

- La vista previa de media carta queda mas ancha y baja, acorde al papel fisico.
- La validacion fisica de impresora debe repetir media carta con esta orientacion.

### 2026-06-02 - Capacitacion segura sin base real

Decision:

- Se agrega `docs\manuales\GUIA_CAPACITACION_SEGURA.md` como guia no tecnica para entrenar cajero, supervisor y administrador sin tocar produccion.
- El Manual de Usuario, Manual de Supervisor, Manual de Administrador y Checklist de Capacitacion enlazan la guia.
- El sistema no declara un modo practica productivo integrado; si no existe un entorno aislado, la capacitacion debe hacerse en instalacion separada o base descartable.

Motivo:

- El frente operativo exige que la capacitacion sea parte del producto, pero tambien exige no perder datos ni ensayar anulaciones, cobros o restauraciones sobre informacion real del hospital.

Consecuencia:

- El personal tiene pasos concretos para practicar fallos reales sin depender del desarrollador.
- Produccion queda protegida contra usuarios de practica, seeders, restauraciones sobre base real y recibos ficticios confundidos con documentos reales.

### 2026-06-02 - Health publico sin detalles internos de auditoria

Contexto:
- `/api/system/health` es una verificacion publica y liviana para continuidad operativa LAN.
- La lista de errores recientes usaba `audit_logs` y podia exponer `id` interno y `entity_type` de modelos Laravel.

Decision:
- El resumen publico conserva solo `action` y `created_at` para indicar actividad reciente sin filtrar clases, ids, rutas, valores de auditoria ni datos tecnicos.
- Los detalles completos permanecen en auditoria interna y vistas protegidas de soporte/administracion.

Validacion:
- `php artisan test --filter=OperationalMetricsServiceTest`
- `php vendor/bin/pint --test app/Actions/Reports/OperationalMetricsService.php tests/Feature/OperationalMetricsServiceTest.php`
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/check-branding.ps1`

### 2026-06-02 - Operaciones lista cambios de catalogo

Decision:

- El reporte operativo incluye `catalog_changes` y `summary.service_change_count` para cambios auditados de servicios.
- Los valores expuestos se sanitizan: se omiten ids tecnicos, slug y codigos de escaneo, y `category_id`/`area_id` se traducen a nombres humanos cuando existen.

Motivo:

- Precio, visibilidad, billability, categoria, area y alias de servicios son base institucional de facturacion y deben poder revisarse sin memoria humana.
- Administracion necesita ver cambios importantes del catalogo en el mismo contexto operativo que anulaciones, reversos, reimpresiones y respaldos.

Validacion:

- `php artisan test --filter=ReportsTest`
- `php vendor/bin/pint --test app/Actions/Reports/OperationsReportService.php tests/Feature/ReportsTest.php`

### 2026-06-02 - Auditoria UI muestra catalogo sin campos tecnicos

Decision:

- La pesta�a de Auditoria muestra `catalog_changes` con etiquetas humanas: servicio, tipo de cambio, antes, despues, motivo, usuario y fecha.
- La UI traduce acciones como `service.price_updated` a texto administrativo y no renderiza `category_id`, codigos internos ni valores crudos de reglas especiales.

Motivo:

- Soporte y administracion deben poder explicar un cambio de precio o visibilidad sin revisar logs tecnicos ni pedir ayuda del desarrollador.
- Los detalles tecnicos siguen disponibles en auditoria interna, pero el reporte normal debe ser comprensible para personal no tecnico.

Validacion:

- `npm.cmd run test -- AuditoriaTab.test.tsx ReportsView.test.tsx`
- `npm.cmd run lint`
- `npm.cmd run build`

### 2026-06-02 - Informacion del sistema muestra diagnostico administrativo seguro

Decision:

- La pantalla Informacion del sistema conserva el resumen publico de salud para usuarios normales.
- Usuarios admin ven un diagnostico administrativo resumido con backend, base de datos, frontend, ultimo respaldo, cola, hora del servidor, espacio libre, acceso LAN, version y migraciones.
- La UI no renderiza comandos de worker, rutas locales, variables crudas ni secretos; esos detalles siguen reservados para soporte tecnico protegido.

Motivo:

- Administracion necesita revisar continuidad operativa sin entrar a Respaldos ni interpretar JSON tecnico.
- Cajeros no deben disparar consultas protegidas ni ver detalles que no ayudan durante el turno.

Validacion:

- `npm.cmd run test -- AboutView.test.tsx AppRoutes.lazy.test.tsx`
- `npm.cmd run test -- App.test.tsx`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

### 2026-06-02 - Facturas e items conservan montos en centavos

Decision:

- `invoices` e `invoice_items` guardan columnas enteras en centavos junto a los decimales visibles.
- La emision de facturas, el registro de pagos, la reversa de pagos y la conciliacion de caja mantienen esos enteros sincronizados.
- La conciliacion suma `balance_due_cents` y solo usa el decimal visible como fallback por fila heredada sin backfill.

Motivo:

- Reportes y cierres no deben depender de `ROUND(decimal * 100)` repetido en SQL para saldos y totales historicos.
- Una fuente entera reduce errores de redondeo y permite detectar discrepancias entre valor visible y fuente financiera.

Validacion:

- `php artisan migrate`
- `php artisan test --filter=CalculateInvoiceTotalsActionTest`
- `php artisan test --filter=PaymentCentsSqlGuardTest`
- `php artisan test --filter=InvoiceCreationTest`
- `php artisan test --filter=CashPaymentsReceiptTest`
- `php vendor/bin/pint --test app/Actions/Billing/CalculateInvoiceTotalsAction.php app/Actions/Billing/CreateInvoiceAction.php app/Actions/Cash/BuildCashReconciliationAction.php app/Actions/Payments/RegisterPaymentAction.php app/Actions/Payments/VoidPaymentAction.php app/Models/Invoice.php app/Models/InvoiceItem.php tests/Unit/CalculateInvoiceTotalsActionTest.php tests/Unit/PaymentCentsSqlGuardTest.php tests/Feature/InvoiceCreationTest.php tests/Feature/CashPaymentsReceiptTest.php database/migrations/2026_06_02_000002_add_cents_columns_to_invoices_and_items.php`

### 2026-06-02 - Reportes financieros evitan redondeo SQL de decimales

Decision:

- `invoice_items` guarda `quantity_cents` como cantidad entera en centesimas junto al decimal visible.
- `FinancialFactsService` lee `total_cents`, `balance_due_cents` y `line_total_cents` para facturado, pendiente y prorrateos por categoria o area.
- Los reportes financieros dejan de usar `ROUND(total * 100)`, `ROUND(balance_due * 100)` o `ROUND(invoice_items.line_total * 100)`.

Motivo:

- Los cierres de caja y reportes administrativos deben sostener sumas repetibles aunque el cajero filtre por area, categoria, caja o metodo.
- Mantener cantidades y montos como enteros reduce drift en MariaDB/MySQL y facilita auditar diferencias entre valor visible y fuente financiera.

Validacion:

- `php artisan test --filter=PaymentCentsSqlGuardTest`
- `php artisan test --filter=FinancialFactsReportTest`
- `php artisan test --filter=ReportsTest`
### 2026-06-02 - CSP con nonce por request y arranque productivo sin carrera

Decision:

- Laravel genera un nonce por request, lo guarda en atributos de request y reemplaza `__S_HOSPITAL_CSP_NONCE__` en el HTML compilado de la SPA.
- Vite deja un placeholder estable en `index.html` para meta/script durante build; el valor real solo se inyecta al servir la pagina.
- `script-src` usa nonce y no permite `unsafe-inline`; `style-src` mantiene `unsafe-inline` porque la UI React actual usa estilos inline en barras, graficos y componentes de progreso.
- nginx no emite un segundo `Content-Security-Policy`; solo conserva un report-only alineado para evitar ruido falso en diagnostico.
- La imagen productiva usa `backend/docker/entrypoint.sh` para esperar MariaDB; solo `backend` ejecuta migraciones y `queue-worker` las omite con `RUN_MIGRATIONS=false`.
- `setup.bat` espera el healthcheck real de MariaDB con contador seguro antes de migrar/optimizar.

Motivo:

- Una CSP estricta mal sincronizada puede dejar la caja en blanco despues de instalar o reiniciar el servidor.
- Los estilos inline existentes deben seguir funcionando hasta que puedan migrarse a clases/tokens sin romper flujos de caja.
- Evitar migraciones simultaneas entre backend y worker reduce riesgo de carrera durante reinicios por corte de energia.

Validacion:

- `php artisan test --filter=SecurityHeadersTest`
- `php artisan test --filter=ProductionSpaRouteTest`
- `npm.cmd run test -- csp-nonce.test.ts`
- `npm.cmd run lint`
- `npm.cmd run build`
- `scripts/assert_production_docker_sources.ps1`
- `scripts/check-branding.ps1`
- Smoke Playwright `http://localhost:8000/login`: cero errores de consola, nonce de header/meta coincide, sin placeholder y sin `<undefined>`.

### 2026-06-02 - Health checks no bloquean el polling operativo normal

Decision:

- `/api/health` y `/api/system/health` mantienen rate limit, pero suben a `120,1`.
- El limite protege endpoints publicos sin generar falsos errores cuando el shell, ayuda, respaldos y pruebas de arranque consultan diagnostico en pocos segundos.

Motivo:

- El limite anterior `10,1` produjo `429 Too Many Requests` durante el e2e institucional y dejaba ruido de consola en pantallas operativas.
- El diagnostico local debe alertar fallos reales, no bloquear verificaciones normales del propio sistema.

Validacion:

- `docker compose exec backend php artisan test --filter=HealthCheckTest`
- `npm.cmd run e2e -- production-readiness.spec.ts`

### 2026-06-02 - Nueva factura separa layout de orquestacion

Decision:

- `NewInvoiceView` conserva estado, permisos, API y acciones de facturacion.
- `NewInvoiceViewLayout` concentra la estructura visual, modales, alertas y referencias de teclado del flujo de caja.

Motivo:

- La pantalla de caja es critica y estaba acumulando demasiada presentacion junto a reglas de emision, pago e impresion.
- Separar layout reduce riesgo al mejorar mensajes, accesibilidad y soporte operativo sin tocar calculos ni transacciones.

Validacion:

- `npm.cmd run test -- NewInvoiceView.test.tsx InvoiceCart.test.tsx InvoiceConfirmation.test.tsx InvoiceSuccess.test.tsx ServiceSearch.test.tsx`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\check-branding.ps1`
- `npm.cmd run e2e -- production-readiness.spec.ts`


### 2026-06-02 - Reportes muestran la base del monto en UI y exports

Decision:

- Los reportes por categoria, area y servicio exponen `amount_basis`, `amount_label` y `amount_source`.
- La UI, Excel y PDF usan esa metadata para distinguir "Facturado" de "Cobrado asignado proporcionalmente".
- Cuando el reporte se filtra por metodo, cajero o caja, el monto visible se etiqueta como cobro proporcional y no como monto facturado.

Motivo:

- Administracion no debe presentar cobros filtrados como facturacion emitida.
- Cada monto debe indicar su fuente para que una lectura posterior no dependa de memoria humana.

Validacion:

- `php artisan test --filter=ReportsTest::test_range_filters_apply_to_category_services_and_cashier_reports`
- `php artisan test --filter=ReportsTest::test_report_export_labels_payment_scoped_breakdowns_as_prorated_collected_amounts`
- `php artisan test --filter=ReportsTest::test_period_closure_pdf_labels_payment_scoped_breakdowns_as_prorated_collected_amounts`
- `npm run typecheck`
- `npm run test -- IncomeReportTab.test.tsx ServiceSalesTab.test.tsx --run`
- `npm run build`

### 2026-06-02 - Fallos de respaldo se auditan como fallos

Decision:

- `CreateBackupAction` audita `backup.created` solo cuando el respaldo termina en `success`.
- Si el dump falla, el evento final queda como `backup.failed`, separado de `backup.requested`.
- El mensaje operativo sigue sanitizado y no expone password, SQLSTATE ni rutas locales.

Motivo:

- Administracion necesita distinguir un respaldo realmente creado de un intento fallido.
- Un audit trail que marca fallos como creados puede inducir a confianza falsa antes de una restauracion.

Validacion:

- `php artisan test --filter=BackupWorkflowTest::test_failed_backup_persists_operator_safe_support_message`
- `php artisan test --filter=BackupWorkflowTest`

### 2026-06-02 - Reporte de caja usa totales de conciliacion visibles

Decision:

- La pestana de reporte de caja muestra "Esperado" desde `expected_cash_amount`, no desde `cash_session.expected_amount`.
- `cash_session.expected_amount` queda como snapshot de cierre; en cajas abiertas puede ser `null`.
- El reporte visible tambien expone "Cobrado" y "Pendiente" desde `payments_total`, `pending_amount` y `pending_invoice_count`.

Motivo:

- Administracion debe poder revisar una caja abierta sin ver `L. 0.00` cuando el backend ya calculo el efectivo esperado.
- El saldo pendiente debe estar visible junto a la conciliacion para no confundirse con dinero cobrado.

Validacion:

- `npm run test -- CashSessionReportTab.test.tsx --run`

### 2026-06-02 - Movimientos de caja usan etiquetas humanas

Decision:

- La tabla de movimientos del reporte de caja no muestra enums crudos como `payment_void`, `opening` o `closing`.
- Los tipos de movimiento se traducen a etiquetas operativas: apertura, cobro registrado, reverso de pago, cierre de caja y ajuste.
- Los montos de movimientos aceptan signo para que un reverso conserve su valor negativo visible.

Motivo:

- Administracion necesita leer movimientos de caja sin interpretar codigos internos.
- Un reverso de pago no debe verse como `L. 0.00`; debe conservar la correccion financiera trazable.

Validacion:

- `npm run test -- CashSessionReportTab.test.tsx --run`

### 2026-06-02 - Filtro por metodo acota hechos de factura

Decision:

- `FinancialFactsService` aplica alcance por pagos cuando un reporte usa `method`, `user_id` o `cash_session_id`.
- Ese alcance evita que `total_billed`, `total_pending` y `total_partial` incluyan facturas de otros metodos/cajeros/cajas.
- Los hechos de factura siguen respetando `issued_at`; los cobros y desgloses cobrados siguen respetando `paid_at`.

Motivo:

- Un reporte filtrado por transferencia no debe mostrar facturado o pendiente de facturas cobradas en efectivo o sin pago del metodo filtrado.
- Administracion necesita que los filtros cambien los totales de forma consistente sin mezclar fuentes de fecha.

Validacion:

- `php artisan test --filter=ReportsTest::test_income_report_method_filter_scopes_billed_and_pending_to_matching_payments`
- `php artisan test --filter=ReportsTest::test_payment_scoped_breakdowns_use_payment_date_not_invoice_issue_date`
- `php artisan test --filter=ReportsTest`
- `vendor/bin/pint --test app/Actions/Reports/FinancialFactsService.php tests/Feature/ReportsTest.php`

### 2026-06-02 - Exportacion de caja usa fechas de la caja consultada

Decision:

- La exportacion Excel desde la pestana Caja construye `date_from` y `date_to` desde `cash_session.opened_at` y `cash_session.closed_at`.
- La exportacion de caja ya no arrastra filtros de rango, metodo, area, categoria o cajero que pertenezcan a otra pestana.
- Si la caja esta abierta, `date_to` usa la fecha de apertura como fallback seguro hasta que el backend reciba una fecha de cierre.

Motivo:

- Una caja historica debe exportarse con el mismo periodo que se esta revisando en pantalla.
- Usar el rango global actual podia generar un archivo que no cuadraba con la caja consultada.

Validacion:

- `npm run test -- ReportsView.test.tsx --run`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

### 2026-06-02 - Fallas de impresion muestran recuperacion segura

Decision:

- `ReceiptPreview` muestra una alerta humana cuando no se puede auditar o abrir la impresion del recibo.
- El cajero no ve errores tecnicos ni stack traces; ve que no debe repetir la factura ni el cobro y que debe revisar Historial o pedir soporte.
- La alerta esta marcada como `no-print` para no contaminar el recibo institucional.

Motivo:

- Una impresora que no responde es un fallo operativo comun y no debe inducir a duplicar pagos o facturas.
- El detalle tecnico debe quedar para soporte, no para la pantalla de caja.

Validacion:

- `npm run test -- ReceiptPreview.test.tsx ReceiptPreview.a11y.test.tsx --run`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `scripts/check-branding.ps1`
- Smoke Playwright contra `frontend/dist` con API mockeada y captura en `qa/screenshots/receipt-print-failure-2026-06-02/receipt-print-failure.png`

### 2026-06-02 - Export Excel administrativo usa etiquetas legibles para areas y categorias

Decision:

- La hoja de ingresos por area del export Excel usa la etiqueta institucional de areas en el XLSX generado.
- Los encabezados de cobros asignados por categoria y area usan etiquetas humanas completas en el XLSX generado.
- El fallback de area sin clasificar usa una etiqueta humana completa para evitar reportes institucionales con texto incompleto.

Motivo:

- Los exports son evidencia administrativa; deben ser legibles y no parecer datos tecnicos o rotos.
- La lectura de ingresos por area/categoria debe mantener el mismo lenguaje humano que la pantalla y el PDF.

Validacion:

- `php artisan test --filter='ReportsTest::test_report_export_includes_area_income_sheet|ReportsTest::test_report_export_labels_payment_scoped_breakdowns_as_prorated_collected_amounts' --colors=never`

### 2026-06-02 - Export de caja normaliza rango por fechas reales de la caja

Decision:

- Cuando el export Excel recibe `cash_session_id`, el backend reemplaza `date_from` y `date_to` por `opened_at` y `closed_at` de esa caja.
- Si la caja sigue abierta, `date_to` usa la fecha de apertura como fallback.
- La normalizacion se hace despues de autorizacion, conservando la restriccion de que un cajero solo exporta su propia caja.

Motivo:

- El backend debe ser fuente de verdad aunque el frontend mande un rango equivocado o alguien llame el endpoint directamente.
- Un export de caja historica no debe omitir cobros por depender de memoria humana o filtros de otra pantalla.

Validacion:

- `php artisan test --filter=ReportsTest::test_cash_session_export_uses_cash_session_dates_even_when_request_range_is_wrong --colors=never`
- `php artisan test --filter=ReportsTest --colors=never`
- `vendor/bin/pint --test app/Http/Requests/Reports/ExportReportRequest.php tests/Feature/ReportsTest.php`

### 2026-06-02 - PDF de caja normaliza rango por fechas reales de la caja

Decision:

- Cuando el PDF de cierre de periodo recibe `cash_session_id`, el backend reemplaza `date_from` y `date_to` por `opened_at` y `closed_at` de esa caja.
- La normalizacion aplica tanto a administracion como a cajeros autorizados, despues de validar permisos y propiedad de caja.
- Si la caja sigue abierta, `date_to` usa la fecha de apertura como fallback.

Motivo:

- El PDF debe coincidir con la caja consultada aunque el request traiga filtros heredados de otra pantalla.
- Administracion necesita un documento imprimible que no pierda cobros historicos por un rango equivocado.

Validacion:

- `php artisan test --filter=ReportsTest::test_cash_session_period_pdf_uses_cash_session_dates_even_when_request_range_is_wrong --colors=never`
- `php artisan test --filter=ReportsTest --colors=never`
- `vendor/bin/pint --test app/Http/Requests/Reports/PdfExportRequest.php tests/Feature/ReportsTest.php`

### 2026-06-02 - Excel declara cobros asignados como prorrateados

Decision:

- Cuando los desgloses de categoria, area o servicio en Excel usan filtros de pago, caja o cajero, el encabezado de monto dice `Cobrado asignado proporcionalmente`.
- El label queda alineado con el PDF y con la fuente `Pagos publicados filtrados, asignados proporcionalmente a items de factura por snapshot historico`.

Motivo:

- Un cobro filtrado por metodo o caja no siempre pertenece completo a una sola categoria, area o servicio.
- Administracion necesita saber que esos montos son una asignacion proporcional y no facturacion directa ni cobro exacto por item.

Validacion:

- `php artisan test --filter=ReportsTest::test_report_export_labels_payment_scoped_breakdowns_as_prorated_collected_amounts --colors=never`
- `php artisan test --filter=ReportsTest --colors=never`
- `vendor/bin/pint --test app/Actions/Reports/PremiumExcelExportService.php tests/Feature/ReportsTest.php`

### 2026-06-02 - CSP productiva exige nonce tambien en estilos

Decision:

- En ambiente `production`, `Content-Security-Policy` usa `style-src 'self' 'nonce-...'` y elimina `unsafe-inline` para estilos.
- Desarrollo conserva `unsafe-inline` para compatibilidad local, pero mantiene nonce para probar la ruta.
- La ruta SPA y el plugin Vite `csp-nonce` siguen siendo la fuente autorizada para sustituir el nonce por request.

Motivo:

- Reducir superficie de inyeccion en el sistema instalado sin depender de internet ni servicios externos.
- Mantener la proteccion compatible con los estilos y scripts emitidos por el build productivo.

Validacion:

- `php artisan test --filter=SecurityHeadersTest --colors=never`
- `php artisan test --filter=ProductionSpaRouteTest::test_spa_html_substitutes_csp_nonce_placeholder --colors=never`
- `npm run test -- csp-nonce.test.ts --run`
- `vendor/bin/pint --test app/Http/Middleware/AddSecurityHeaders.php tests/Feature/SecurityHeadersTest.php`

### 2026-06-02 - Excel registra filtros administrativos con etiquetas humanas

Decision:

- La hoja `Filtros Aplicados` del Excel agrega filtros activos de caja, metodo, estado, cajero, area y categoria.
- Los valores se muestran como etiquetas humanas, por ejemplo `Efectivo`, `Pagada`, nombre de cajero, nombre de area y nombre de categoria.
- El export evita escribir IDs crudos de usuario, area o categoria como valor visible del filtro.

Motivo:

- Un reporte exportado debe poder revisarse despues sin depender de memoria humana sobre que filtros se aplicaron.
- Administracion necesita entender el alcance del archivo sin interpretar parametros tecnicos de la URL.

Validacion:

- `php artisan test --filter=ReportsTest::test_report_export_records_active_filters_with_human_labels --colors=never`
- `php artisan test --filter=ReportsTest --colors=never`
- `vendor/bin/pint --test app/Actions/Reports/PremiumExcelExportService.php tests/Feature/ReportsTest.php`

### 2026-06-02 - Excel describe caja exportada sin IDs tecnicos

Decision:

- La hoja `Filtros Aplicados` del Excel ya no presenta la caja como `Caja #id`.
- Cuando se filtra por caja, el valor visible usa cajero, fecha/hora de apertura y estado humano (`Abierta` o `Cerrada`).
- El ID de la sesion queda fuera del valor administrativo visible del filtro.

Motivo:

- Administracion debe poder leer un reporte exportado sin interpretar identificadores internos.
- La caja es una fuente financiera, por lo que su referencia debe ser auditable y humana: quien opero, cuando abrio y en que estado estaba.

Validacion:

- `php artisan test --filter=ReportsTest::test_report_export_records_active_filters_with_human_labels --colors=never`
- `php artisan test --filter=ReportsTest --colors=never`
- `vendor/bin/pint --test app/Actions/Reports/PremiumExcelExportService.php tests/Feature/ReportsTest.php`

### 2026-06-02 - PDF consolidado declara filtros administrativos

Decision:

- El PDF de cierre consolidado recibe los filtros autorizados usados para calcular el reporte.
- Cuando hay filtros activos, el PDF incluye una seccion `Filtros aplicados` con etiquetas humanas para caja, metodo, estado, cajero, area y categoria.
- La caja se describe con cajero, apertura y estado; no se imprime como `Caja #id`.

Motivo:

- Un PDF administrativo debe poder auditarse despues sin depender de la URL original ni de memoria humana.
- Los filtros cambian la lectura financiera; por eso deben quedar visibles en el documento impreso/exportado junto a las cifras.

Validacion:

- `php artisan test --filter=ReportsTest::test_period_closure_pdf_declares_active_filters_with_human_labels --colors=never`
- `php artisan test --filter=ReportsTest --colors=never`
- `vendor/bin/pint --test app/Actions/Reports/PdfExportService.php app/Http/Controllers/ReportController.php tests/Feature/ReportsTest.php`

### 2026-06-02 - Auditoria de roles y permisos usa eventos Spatie

Decision:

- La configuracion `permission.events_enabled` queda activa para emitir cambios de asignacion y retiro de roles/permisos.
- `AppServiceProvider` conecta esos eventos con `PermissionAuditObserver`, que registra solo IDs y nombres seguros en `audit_logs`.
- La actualizacion de usuarios evita llamar `syncRoles` cuando el rol solicitado ya esta asignado, reduciendo ruido en auditoria.

Motivo:

- Soporte necesita reconstruir quien cambio permisos sin revisar tablas pivote manualmente.
- Los cambios de autorizacion son sensibles para caja y administracion; deben quedar registrados sin exponer contrasenas, tokens ni rutas internas.

Validacion:

- `php artisan test --filter=PermissionAuditTest --colors=never`
- `php artisan test --filter=UserManagementTest --colors=never`
- `vendor/bin/phpstan analyse app/Providers/AppServiceProvider.php app/Observers/PermissionAuditObserver.php app/Http/Controllers/UserController.php tests/Feature/PermissionAuditTest.php --no-progress --error-format=table`
- `vendor/bin/pint --test app/Providers/AppServiceProvider.php app/Observers/PermissionAuditObserver.php app/Http/Controllers/UserController.php tests/Feature/PermissionAuditTest.php config/permission.php`

### 2026-06-02 - Modo mantenimiento institucional con payload seguro

Decision:

- El comando `hospital:maintenance` usa descripcion y ayuda en espanol institucional.
- El archivo `storage/framework/down` incluye `status: 503` junto al mensaje visible y no guarda secretos ni bypass.
- Las respuestas de mantenimiento para HTML y API quedan cubiertas por pruebas para evitar texto tecnico o mojibake visible.

Motivo:

- Durante un incidente, el personal debe entender que el sistema esta en mantenimiento sin instrucciones tecnicas ni mensajes de framework.
- Soporte necesita un estado HTTP claro y una pantalla segura mientras recupera servicios sin borrar datos.

Validacion:

- `php artisan test --filter=MaintenanceModeTest --colors=never`
- `vendor/bin/phpstan analyse app/Console/Commands/MaintenanceCommand.php tests/Feature/MaintenanceModeTest.php --no-progress --error-format=table`
- `vendor/bin/pint --test app/Console/Commands/MaintenanceCommand.php bootstrap/app.php tests/Feature/MaintenanceModeTest.php`
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/check-branding.ps1`

### 2026-06-02 - Manual operador usa validacion LAN con evidencia

Decision:

- El indice maestro de operador apunta la validacion de cliente LAN a `scripts\validate_lan_client.ps1`.
- El comando documentado escribe `qa\LAN_CLIENT_VALIDATION_PROOF.md` para dejar evidencia revisable por soporte.
- Se agrega una prueba que falla si el manual vuelve a recomendar `ping_lan_clients.ps1` como validacion principal de cliente.

Motivo:

- Un ping superficial no prueba que login, rutas publicas y assets del frontend carguen desde una computadora cliente.
- Soporte necesita evidencia guardada para distinguir red local caida, build incompleto o servidor no disponible sin pedir al operador interpretar detalles tecnicos.

Validacion:

- `php artisan test --filter=OperatorManualTest --colors=never`
- `vendor/bin/phpstan analyse tests/Feature/OperatorManualTest.php --no-progress --error-format=table`
- `vendor/bin/pint --test tests/Feature/OperatorManualTest.php`

## 2026-06-02 - Selector humano de caja en reportes por rango

Contexto: el filtro de caja en reportes por rango aceptaba solo un numero manual, lo que obligaba a administracion a recordar IDs internos y aumentaba el riesgo de consultar una caja incorrecta.

Decision: el frontend intenta cargar las sesiones de caja desde `/api/cash-sessions` y, cuando hay datos listables, muestra un selector con cajero, fecha de apertura y estado. El valor enviado al backend sigue siendo `cash_session_id`; si la lista no esta disponible por permisos o error, se conserva el campo manual como fallback operativo.

Criterio de verificacion: `ReportsView.test.tsx` valida que una sesion visible como "Cajero Validacion - 2026-05-17 - Abierta" se envie como `cash_session_id=11` al reporte.

## 2026-06-02 - Selector humano de cajero en reportes por rango

Contexto: el filtro de cajero en reportes por rango tambien dependia de escribir un ID manual, lo que mezclaba datos tecnicos con decisiones administrativas.

Decision: cuando las sesiones de caja listadas incluyen usuario, el frontend deriva una lista unica de cajeros y muestra un selector con nombre y usuario. El valor enviado al backend sigue siendo `user_id`; si no hay usuarios listables, se conserva el campo manual como fallback operativo.

Criterio de verificacion: `ReportsView.test.tsx` valida que "Cajero Validacion (cajero.validacion)" se envie como `user_id=2` junto al filtro de caja seleccionado.

### 2026-06-02 - Validador LAN tiene prueba de seguridad no destructiva

Decision:

- `scripts\test_validate_lan_client_safety.ps1` valida que `validate_lan_client.ps1 -WhatIfOnly` no escriba evidencia.
- La prueba confirma que la evidencia LAN solo puede guardarse dentro de `qa\`, que no se reemplaza sin `-Force` y que URLs con usuario/contrasena se rechazan sin exponer credenciales.
- La prueba usa un fixture temporal y no consulta la red ni toca datos reales.

Motivo:

- El validador LAN ahora es el camino documentado para evidencia desde una PC cliente, por lo que debe ser seguro antes de pedirlo a personal no tecnico.
- Una evidencia mal ubicada o una URL con credenciales podria exponer datos operativos o confundir a soporte durante instalacion y entrega.

Validacion:

- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test_validate_lan_client_safety.ps1`
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test_operational_url_safety.ps1`

## 2026-06-02 - OpenAPI documenta filtros financieros avanzados

Contexto: el contrato generado por `/api/system/openapi` no listaba los endpoints avanzados de reportes (`income`, `categories`, `areas`, `services`, `operations`, `export`, `pdf`) ni sus filtros de rango. Eso dejaba la integracion administrativa sin una fuente verificable de parametros para caja, cajero, area, categoria, metodo y estado.

Decision: `OpenApiExporter` ahora incluye esos paths y declara sus query parameters. Los IDs siguen siendo parametros tecnicos de consulta; `docs/API_CONTRACTS.md` aclara que pantallas y exportaciones deben resolverlos a etiquetas humanas antes de mostrarlos.

Criterio de verificacion: `OpenApiExporterTest::test_advanced_report_paths_declare_supported_query_filters` valida paths y filtros clave como `cash_session_id`, `user_id`, `method`, `status` y los rangos de fecha.

## 2026-06-02 - PHPStan usa ruta vigente de Larastan

Contexto: `vendor/bin/phpstan analyse` fallaba antes de analizar codigo porque `phpstan.neon` apuntaba a `vendor/nunomaduro/larastan/extension.neon`, ruta historica que no existe con la dependencia actual `larastan/larastan`.

Decision: actualizar el include a `vendor/larastan/larastan/extension.neon`. El analisis focal de `OpenApiExporter` queda limpio con `--memory-limit=512M`.

Estado restante: el analisis completo del backend ahora ejecuta y revela deuda existente de modelos Eloquent sin propiedades PHPDoc/casts tipados (`property.notFound`, 291 errores). No se corrige en esta subfase para no mezclar el contrato de reportes con una refactorizacion amplia de modelos.

## 2026-06-02 - Comandos agentic usan el servicio Docker real

Contexto: el compose de desarrollo define los servicios `backend`, `frontend` y `mysql`, pero `AGENTS.md` indicaba comandos con `docker compose exec app`. En una validacion real ese servicio no existia y las pruebas no arrancaban, lo que podia bloquear a soporte o a un agente durante un diagnostico local.

Decision: los comandos base de backend en `AGENTS.md` ahora usan `docker compose exec backend ...`, alineados con `docker-compose.yml` y `docker-compose.prod.yml`. No se cambia la topologia Docker ni se agrega un alias de servicio para evitar ambiguedad.

Criterio de verificacion: `docker compose ps` muestra `backend` como servicio activo y `docker compose exec backend php artisan test --filter=OpenApiExporterTest` pasa.

## 2026-06-02 - PHPStan completo cubre modelos y flujos operativos criticos

Contexto: al activar Larastan sobre todo el backend, el analisis estatico aun encontraba errores por relaciones Eloquent sin tipo, una excepcion de cierre de caja sin namespace real y configuracion Echo leida con `env()` en runtime. Eso dificultaba diagnosticar cambios de caja, reversos, realtime LAN y backups sin depender del desarrollador.

Decision: se tipan relaciones Eloquent usadas por categorias/facturas, `ReverseInvoiceAction` trabaja con una coleccion de pagos tipada, `CloseCashSessionAction` usa `Illuminate\Auth\Access\AuthorizationException` y `EchoConfigController` lee configuracion desde `config()` para ser compatible con config cache. No se cambian reglas fiscales ni datos.

Criterio de verificacion: `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G --error-format=table` pasa sin errores. Tambien pasan `BroadcastingWiringTest`, `InvoiceReverseTest`, `CashPaymentsReceiptTest`, `BackupWorkflowTest`, Pint focal y `scripts\check-branding.ps1`.

## 2026-06-03 - Handoff final ejecuta gate de paquete seguro para soporte

Contexto: `scripts\validate_support_packet_safety.ps1` protegia el paquete de soporte contra `.env`, secretos y rutas locales reales, pero el cierre final aun podia generar el reporte sin ejecutar ese gate. El frente operativo depende de que soporte reciba evidencia util sin exponer credenciales ni datos innecesarios.

Decision: `scripts\final_production_handoff.ps1` ejecuta `validate_support_packet_safety.ps1`, incluye su salida en el reporte y bloquea `PRODUCTION_READY` si el gate falla. Este gate se ejecuta antes de capacitacion segura y antes de validar el indice del reporte.

Criterio de verificacion: `final_production_handoff.ps1 -SkipPreflight -ReportPath qa\HANDOFF_EVIDENCE_INDEX_SMOKE_2026_06_03.md` genera reporte `PRODUCTION_CANDIDATE`, incluye `SUPPORT_PACKET_SAFETY: YES`, `TRAINING_SAFETY: YES` y mantiene `OPS_EVIDENCE_INDEX: YES`.
## 2026-06-03 - Handoff final ejecuta gate de capacitacion segura

Contexto: `scripts\validate_training_safety.ps1` protegia manuales y Ayuda, pero el cierre final aun podia generar `FINAL_PRODUCTION_HANDOFF_RESULT.md` sin ejecutar ese gate. Eso dejaba la capacitacion segura como paso manual y podia permitir entregar material que no advierte contra practicar en produccion.

Decision: `scripts\final_production_handoff.ps1` ejecuta `validate_training_safety.ps1`, incluye su salida en el reporte y bloquea `PRODUCTION_READY` si el gate falla. El handoff conserva luego la validacion de indice sobre el reporte ya escrito.

Criterio de verificacion: `final_production_handoff.ps1 -SkipPreflight -ReportPath qa\HANDOFF_EVIDENCE_INDEX_SMOKE_2026_06_03.md` genera reporte `PRODUCTION_CANDIDATE`, incluye `TRAINING_SAFETY: YES` y mantiene `OPS_EVIDENCE_INDEX: YES`.
## 2026-06-03 - Gate de capacitacion segura

Contexto: el frente operativo exige que la capacitacion sea parte del producto, pero no puede permitir que cajeros, supervisores o administradores ensayen facturas, cobros, anulaciones, restauraciones o respaldos sobre la base real del hospital.

Decision: se agrega `scripts\validate_training_safety.ps1` para validar que `docs\manuales\GUIA_CAPACITACION_SEGURA.md`, `docs\manuales\CHECKLIST_CAPACITACION.md` y la pantalla `HelpView` con su test conserven instrucciones de entorno aislado, base descartable, roles, fallos que deben practicarse y acciones prohibidas en produccion.

Criterio de verificacion: `scripts\validate_training_safety.ps1` reporta `TRAINING_SAFETY: YES`; `scripts\assert_offline_release_clean.ps1` exige que el script viaje en el paquete offline y coincida con la fuente versionada.

## 2026-06-03 - Handoff final valida su propio indice de evidencia

Contexto: `scripts\validate_ops_evidence_index.ps1` podia ejecutarse manualmente, pero `scripts\final_production_handoff.ps1` escribia el reporte final sin comprobar que ese mismo reporte conservara referencias `qa/`, bloqueantes fisicos y ausencia de rutas locales o secretos obvios.

Decision: `final_production_handoff.ps1` escribe un borrador, ejecuta `validate_ops_evidence_index.ps1` contra el reporte generado, reescribe el handoff con la salida del gate y bloquea `PRODUCTION_READY` si el indice falla. El reporte generado enumera explicitamente las pruebas LAN, impresora, restore y concurrencia como referencias Markdown bajo `qa/`.

Criterio de verificacion: `final_production_handoff.ps1 -SkipPreflight -ReportPath qa\HANDOFF_EVIDENCE_INDEX_SMOKE_2026_06_03.md` genera un reporte `PRODUCTION_CANDIDATE` y el gate de indice pasa sobre ese reporte con `OPS_EVIDENCE_INDEX: YES`.
## 2026-06-03 - Guard offline exige validador de indice de evidencias

Contexto: el handoff final se convirtio en el indice auditable de pruebas, pendientes fisicos y riesgos. Si el paquete offline se arma desde un commit nuevo pero omite `scripts\validate_ops_evidence_index.ps1`, soporte podria entregar evidencia con referencias rotas, rutas locales o una declaracion prematura de `PRODUCTION_READY`.

Decision: `scripts\assert_offline_release_clean.ps1` exige que el paquete incluya `scripts\validate_ops_evidence_index.ps1` y compara su SHA256 contra la fuente versionada, igual que los demas scripts criticos de soporte, arranque, diagnostico y respaldos.

Criterio de verificacion: `scripts\validate_ops_evidence_index.ps1` pasa contra el handoff actual y `scripts\assert_offline_release_clean.ps1` debe fallar hasta que `offline-release` se regenere desde el commit final.

## 2026-06-03 - Guard offline permite solo plantillas QA vacias

Contexto: `scripts\make_offline_release.ps1` debe incluir plantillas vacias para que el hospital documente validacion fisica de LAN, impresora, restore, concurrencia y capacitacion anonima. El guard offline ya exigia esos archivos, pero luego bloqueaba cualquier ruta `qa\`, creando una contradiccion: un paquete bien armado con plantillas de campo podia fallar como si transportara evidencia real.

Decision: `scripts\assert_offline_release_clean.ps1` distingue `qa\*.example.md` permitidos de evidencia real. Solo se permiten las cinco plantillas finales de campo; el resto de `qa\`, paquetes de soporte, logs, dumps SQL, archivos de base y `.env` no-ejemplo siguen bloqueados.

Criterio de verificacion: `scripts\assert_offline_release_clean.ps1 -SelfTest` confirma la allowlist de las cinco plantillas, el builder self-test conserva esas plantillas, el guard offline ya no debe marcarlas como contenido prohibido y `offline-release` sigue bloqueado hasta regenerarse desde el commit final con imagenes Docker reales y manifiesto actualizado.

## 2026-06-03 - Handoff final ejecuta self-test del guard offline

Contexto: el guard offline ya valida que el paquete no lleve evidencia real bajo `qa\` y permite solo plantillas `qa\*.example.md`. Si ese self-test quedaba manual, el handoff podia pasar otros gates sin demostrar que la regla de empaque seguia viva.

Decision: `scripts\final_production_handoff.ps1` ejecuta `scripts\assert_offline_release_clean.ps1 -SelfTest`, registra su codigo de salida y embebe la salida en el reporte final. `PRODUCTION_READY` queda bloqueado si ese self-test falla.

Criterio de verificacion: el handoff con `-SkipPreflight` muestra `Offline release guard self-test exit code: 0` y conserva la salida `Only final-field qa/*.example.md templates are allowed in offline release` dentro del reporte de evidencia.

## 2026-06-03 - Validador de completitud exige self-test offline

Contexto: el handoff final ya ejecuta el self-test del guard offline, pero `scripts\validate_final_handoff_completeness.ps1` aun podia aprobar un reporte que omitiera ese bloque. Eso dejaba una regresion posible: el cierre podia perder la evidencia de que el paquete offline permite solo plantillas `qa\*.example.md` y bloquea evidencia real.

Decision: `scripts\validate_final_handoff_completeness.ps1` exige que el handoff mencione `Offline release guard self-test`, conserve el comando `assert_offline_release_clean.ps1 -SelfTest` y mantenga la salida exacta de allowlist del self-test.

Criterio de verificacion: `scripts\validate_final_handoff_completeness.ps1 -HandoffPath qa\HANDOFF_EVIDENCE_INDEX_SMOKE_2026_06_03.md` reporta `FINAL_HANDOFF_COMPLETENESS: YES` solo si el bloque del self-test offline sigue presente en el handoff.

## 2026-06-03 - Handoff principal conserva evidencia del guard offline

Contexto: `scripts\validate_final_handoff_completeness.ps1` usa `qa\FINAL_PRODUCTION_HANDOFF_RESULT.md` por defecto, mientras el smoke escribe `qa\HANDOFF_EVIDENCE_INDEX_SMOKE_2026_06_03.md`. Al reforzar el contrato de evidencia, el reporte principal quedo temporalmente sin el bloque del self-test offline y el validador por defecto fallo.

Decision: `qa\FINAL_PRODUCTION_HANDOFF_RESULT.md` conserva tambien el self-test del guard offline, el comando `assert_offline_release_clean.ps1 -SelfTest` y la salida de allowlist. Las menciones genericas de plantillas QA no se escriben como rutas `qa/` en backticks para no crear referencias falsas en el indice de evidencia.

Criterio de verificacion: `scripts\validate_final_handoff_completeness.ps1` y `scripts\validate_ops_evidence_index.ps1` pasan tanto contra el handoff principal como contra `qa\HANDOFF_EVIDENCE_INDEX_SMOKE_2026_06_03.md`.
## 2026-06-03 - Handoff lista el guard offline como artefacto critico

Contexto: el handoff ya ejecutaba `assert_offline_release_clean.ps1 -SelfTest`, pero las secciones de archivos cambiados y el validador de completitud no exigian listar `scripts/assert_offline_release_clean.ps1` como guard preservado. Eso podia ocultar el archivo que protege el paquete offline contra evidencia real, secretos y artefactos desfasados.

Decision: el handoff generado y el reporte principal listan `scripts/assert_offline_release_clean.ps1` dentro de los guards de evidencia. `scripts\validate_final_handoff_completeness.ps1` ahora falla si ese archivo no aparece en el handoff.

Criterio de verificacion: `scripts\validate_final_handoff_completeness.ps1` pasa contra el handoff principal y contra `qa\HANDOFF_EVIDENCE_INDEX_SMOKE_2026_06_03.md` solo si el guard offline queda listado como artefacto critico.
## 2026-06-02 - Policies registradas para recursos criticos

Contexto: el frente operativo requiere permisos mantenibles y mensajes de error comprensibles. La auditoria interna ya habia senalado que `app/Policies/` no existia, aunque el sistema autorizaba con Form Requests y guards en Actions. Eso dejaba la matriz de permisos menos visible para soporte y futuras correcciones.

Decision: se agregan `InvoicePolicy` y `CashSessionPolicy`, y `AppServiceProvider` registra ambos mappings con `Gate::policy`. Las policies delegan en las reglas existentes (`InvoiceAccess`, permisos `cash.*` e `invoices.*`) para no cambiar comportamiento de endpoints en esta subfase.

Criterio de verificacion: `AuthorizationStrategyTest` valida existencia y resolucion via `Gate::getPolicyFor`. Tambien pasan PHPStan completo, `InvoiceReverseTest`, `CashPaymentsReceiptTest`, `PermissionAuditTest`, PHPStan/Pint focales y branding check.

## 2026-06-02 - Dockerfile productivo copia tuning PHP-FPM desde ruta versionada

Contexto: el release guard offline fallo porque `backend/Dockerfile.prod` copiaba `docker/php-fpm.conf` con contexto de build en la raiz del repo, pero el archivo versionado vive en `backend/docker/php-fpm.conf`. Eso hacia que el paquete productivo no fuera reproducible.

Decision: `backend/Dockerfile.prod` copia `backend/docker/php-fpm.conf` hacia `/usr/local/etc/php-fpm.d/zz-hospital-tuning.conf`. El Dockerfile de desarrollo mantiene su ruta porque su contexto es `backend/`.

Criterio de verificacion: `scripts\make_offline_release.ps1 -Force -SkipDockerBuild` vuelve a encontrar todas las fuentes Docker productivas y debe reportar `OFFLINE_RELEASE_CLEAN: YES`.

## 2026-05-22 - Metadata privada para app LAN

Contexto: el producto no busca SEO publico; necesita identidad clara de navegador/atajo instalable y privacidad por defecto en una red local.

Decision: frontend/index.html declara descripcion, robots noindex/nofollow/noarchive, manifest e icono local. Laravel sirve /manifest.webmanifest y /icons/* desde frontend/dist, y robots.txt bloquea indexacion.

Criterio de verificacion: ProductionSpaRouteTest protege rutas SPA, manifest, icono y metadata fuente; npm.cmd run build y el test focal pasan.

## 2026-05-22 - Chunk diferido para dashboard

Contexto: el dashboard concentra graficos que no son necesarios para operar caja/facturacion.

Decision: AppRoutes carga el dashboard con React.lazy y LoadingState, manteniendo rutas operativas principales estaticas para no fragilizar navegacion ni pruebas.

Criterio de verificacion: el build genera un chunk DashboardView independiente y pasan npm.cmd run test, npm.cmd run typecheck, npm.cmd run lint y npm.cmd run build.

## 2026-05-22 - Smoke accesible para caja y POS

Contexto: la ruta critica del hospital es operativa y offline; el gate debe proteger teclado, foco, labels y ausencia de errores de consola.

Decision: production-readiness.spec.ts cubre foco inicial de caja, labels de paciente/busqueda/scanner, agregado por teclado en POS, foco de confirmacion, foco de cobro, selector de ancho de recibo y cierre de caja con diferencia.

Criterio de verificacion: qa/ACCESSIBILITY_UX_AUDIT.md registra alcance y resultados; pasan npm.cmd run e2e, npm.cmd run test, npm.cmd run typecheck, npm.cmd run lint y npm.cmd run build.

## 2026-05-22 - Mapa actual de arquitectura

Contexto: el proyecto necesita que cambios futuros respeten fronteras existentes de controllers, Form Requests, Actions, servicios de reportes, UI primitives y features React.

Decision: docs/ARCHITECTURE_CURRENT.md documenta limites actuales de backend, frontend, assets runtime y quality gates; docs/RELEASE_CHECKLIST.md distingue pruebas automatizadas de evidencia fisica real.

Criterio de verificacion: las fases futuras deben actualizar ARCHITECTURE_CURRENT.md cuando cambien limites de modulo o gates obligatorios.

## 2026-05-22 - Evidencia final del pase de pulido

Contexto: la definicion de terminado requiere evidencia reproducible y honesta, separando automatizacion de validacion fisica real.

Decision: qa/PROJECT_POLISH_FINAL_REPORT.md registra comandos finales, resultados, smoke local HTTP y riesgos residuales. El pase de pulido no declara PRODUCTION_READY sin evidencia fisica de LAN, impresora, restore, concurrencia y backup worker.

Criterio de verificacion: el cierre tecnico queda listo para revision del PR, pero el handoff de produccion sigue sujeto a evidencias fisicas/finales.

## 2026-06-02 - Refund workflow (out of scope for v1.0.0, documentado)

Contexto: el manual del cajero (manuales/MANUAL_CAJERO.md) menciona la necesidad operativa de devolver dinero despues de un cobro. AGENTS.md no requiere este flujo y el spec original lo dejo fuera.

Decision: v1.0.0 no implementa un formulario dedicado de devolucion. La necesidad operativa se cubre con dos mecanismos ya existentes:

1. **Pago con monto negativo (aproximacion de devolucion):** si el cajero necesita devolver L. 25 a un paciente despues de un cobro de L. 100 en efectivo, registra un pago con amount=-5.00 sobre la misma cash_session_id, con reference='Devolucion factura 000-001-01-00000042' y el mismo method. La accion RegisterPaymentAction acepta montos negativos; la formula paid_amount_cents = paid_amount_cents + amount_cents y alance_due_cents = total_cents - paid_amount_cents produce el resultado correcto, y el audit log queda balanceado.

2. **Reverso completo de factura pagada:** usar el endpoint POST /api/invoices/{id}/reverse (FASE A3) que anula cada pago (con su cash_movement negativo) y luego la factura, todo en una sola transaccion.

Consecuencia: manuales/MANUAL_CAJERO.md se actualiza en v1.1 para apuntar a estos dos flujos en vez de un formulario separado. Una UI dedicada de 'Devolucion' queda en el roadmap de v1.1 si el feedback operacional del hospital lo justifica.

Criterio de verificacion: el test unit 	ests/Unit/RefundPaymentTest.php (FASE F4) verifica que un pago positivo seguido de un pago negativo deja la factura con paid_amount_cents y balance_due_cents consistentes, y que el audit log contiene ambas entradas.

## 2026-06-05 - Reimpresion exige motivo operativo

Contexto: la reimpresion de recibos ya quedaba auditada con usuario, factura y formato, pero el endpoint aceptaba reimpresiones sin motivo aunque los manuales y la UI orientan a reimprimir con justificacion.

Decision: ReprintReceiptRequest exige reason obligatorio entre 5 y 500 caracteres. La UI sigue compatible porque envia el motivo escrito por el operador o un motivo institucional por defecto para impresiones auditadas desde la vista de recibo.

Criterio de verificacion: InvoiceHistoryReprintVoidTest cubre rechazo de motivo ausente o en blanco y confirma que supervisor/admin siguen reimprimiendo cuando envian motivo. InvoiceAuditControllerTest conserva la auditoria cronologica de reimpresion y anulacion.

## 2026-06-05 - Documentacion actual prioriza recibo institucional

Contexto: el objetivo de presentacion al Hospital San Isidro exige que soporte, arquitectura y evidencia vigente no promuevan impresoras de rollo ni formatos 80mm/58mm como pendientes operativos de produccion.

Decision: las guias actuales de troubleshooting, arquitectura y QA hablan de impresora institucional de oficina y validacion fisica en media carta, carta y A5. El archivo de prueba heredado queda marcado solo como compatibilidad historica y no como artefacto de handoff final.

Criterio de verificacion: scripts/check-branding.ps1 falla si la documentacion actual vuelve a mencionar impresora de rollo, thermal printer, 80mm o 58mm en esas superficies de entrega.

## 2026-06-05 - Recibo institucional marca original y copia

Contexto: el talonario manual del hospital identifica la relacion entre original y copia. El recibo digital ya mostraba solo Original, pero el objetivo de presentacion requiere que el formato institucional haga visible Original / Copia sin agregar codigos tecnicos.

Decision: GenerateReceiptDataAction y ReceiptPreview usan Original / Copia como marca institucional. La reimpresion conserva datos historicos de factura y el cambio no agrega QR, barcode, codigos internos ni campos tecnicos al recibo.

Criterio de verificacion: CashPaymentsReceiptTest valida data.institutional.copy_label; ReceiptPreview.test valida que la marca Original / Copia se renderiza en el recibo.

## 2026-06-05 - Valor en lempiras del recibo institucional

Contexto: el talonario manual del hospital incluye valor en lempiras. El recibo digital mostraba montos numericos, pero no el total escrito en palabras para lectura y comparacion manual.

Decision: el backend calcula invoice.total_in_words desde el total snapshot de la factura usando centavos enteros y lo entrega al recibo. ReceiptPreview solo renderiza el texto recibido como Valor en lempiras, sin recalcular dinero en frontend.

Criterio de verificacion: LempiraAmountWordsTest valida conversiones sin floats; CashPaymentsReceiptTest valida data.invoice.total_in_words; ReceiptPreview.test valida la fila visible Valor en lempiras.

## 2026-06-05 - Recibo sin codigos internos de reglas especiales

Contexto: el recibo institucional no debe imprimir ni exponer codigos internos. El contrato de recibo todavia incluia special_rule_code, aunque la vista solo necesitaba saber si una regla fue aplicada para mostrar una etiqueta humana.

Decision: GenerateReceiptDataAction deja de enviar special_rule_code en items del recibo. El dominio y catalogo conservan el codigo para reglas de negocio, pero el recibo solo conserva special_rule_applied y los snapshots visibles del cobro.

Criterio de verificacion: CashPaymentsReceiptTest valida que service_id, scan_code, barcode, qr_code y special_rule_code no aparecen en items del recibo; ReceiptPreview conserva la etiqueta humana sin depender del codigo interno.

## 2026-06-05 - Diagnostico administrativo sin lenguaje de cola interna

Contexto: la vista Acerca muestra diagnostico administrativo y pulso operativo. Aunque es una pantalla con permiso, el hospital necesita lenguaje accionable para personal no tecnico y soporte local, no terminos internos como cola o trabajos fallidos.

Decision: AboutView cambia esos indicadores a respaldos en espera, respaldos con error y carga de respaldos. Los datos tecnicos del backend siguen existiendo en el contrato, pero la UI los traduce a estado operativo humano.

Criterio de verificacion: AboutView.test valida que el pulso administrativo muestra respaldos con error/carga de respaldos y no expone queue:work, schedule:run, cola ni trabajo(s) fallidos.

## 2026-06-05 - Asistente inicial sin catalogo de muestra

Contexto: el asistente de preparacion podia mostrar servicios precargados y placeholders fiscales ficticios. En una instalacion real eso se percibe como dato demo y puede inducir importaciones accidentales.

Decision: SetupWizardDialog inicia el catalogo solo con el encabezado CSV y pide pegar el catalogo real aprobado por administracion. Los placeholders visibles se cambian a Hospital San Isidro, RTN del hospital y CAI autorizado, sin numeros o claves inventadas.

Criterio de verificacion: SetupWizardDialog.test valida que el asistente no muestra Hospital General El Buen Pastor, CAI ficticio ni servicios precargados como Consulta General, Hemograma o Radiografia.

## 2026-06-05 - Diagnostico sin terminologia de cola visible

Contexto: el diagnostico administrativo ya traduce el estado tecnico de colas a respaldos en espera, respaldos con error y carga de respaldos. El guard de seguridad seguia exigiendo textos de cola/trabajos y podia bloquear el handoff aunque la UI estuviera mas clara para soporte local.

Decision: useServerStatus y validate_system_diagnostics_safety.ps1 quedan alineados al lenguaje humano de respaldos. Los contratos tecnicos de queue_size permanecen en tipos/API para soporte, pero la lectura visible protege contra cola/trabajos/queue en pantalla normal.

Criterio de verificacion: useServerStatus.test cubre alertas de respaldos sin terminologia de cola y validate_system_diagnostics_safety.ps1 debe reportar SYSTEM_DIAGNOSTICS_SAFETY: YES.

## 2026-06-05 - Respaldos avanzados sin tareas visibles

Contexto: la pantalla Respaldos es usada por administracion y soporte local. Aunque puede leer datos tecnicos del backend, el detalle visible debe seguir hablando de respaldos, estados y soporte local, no de tareas internas o colas.

Decision: BackupsView cambia el indicador avanzado de tareas con problema a respaldos con error y el mensaje de respaldo fallido a soporte local. El test a11y abre el detalle avanzado y verifica que no aparezcan tareas, trabajos, cola, queue, worker ni SQLSTATE en la lectura visible.

Criterio de verificacion: BackupsView.a11y.test debe pasar y proteger que los estados visibles permanezcan en lenguaje institucional.

## 2026-06-05 - Ayuda sin cola de trabajos visible

Contexto: la pantalla Ayuda es una superficie normal para cajeros, supervisores y administradores. Aun conservaba lenguaje de cola de trabajos y soporte tecnico en guias visibles de respaldos.

Decision: HelpView usa estado de respaldos, respaldos pendientes o con error y soporte local. El guard validate_help_screen_safety.ps1 bloquea cola de trabajos, trabajos fallidos, queue, worker y soporte tecnico en esa pantalla.

Criterio de verificacion: HelpView.test y validate_help_screen_safety.ps1 cubren que Ayuda conserve lenguaje institucional sin terminos internos.

## 2026-06-05 - Manuales de operador sin lenguaje interno de respaldo
Contexto: manuales de cajero/supervisor/administrador e indice de operador son superficies para personal no tecnico y aun usaban worker/trabajos/soporte tecnico.
Decision: manuales normales usan soporte local, administrador del sistema, automatizacion de respaldos, respaldos pendientes/con error. La guia tecnica puede conservar detalles internos para soporte.
Criterio de verificacion: validate_operator_manuals_safety.ps1 bloquea worker/cola/trabajos/soporte tecnico/responsable tecnico/comandos tecnicos en manuales normales.

## 2026-06-05 - Documentos fuente sin lenguaje comercial de demo
Contexto: algunos planes y reportes QA fuente aun describian el sistema como demo vendible, demo premium o con credenciales/seeders demo, aunque la entrega debe ser institucional.
Decision: documentos de producto y QA actuales usan validacion institucional, validacion local, nucleo operativo y credenciales/seeders de validacion temporal. El tipo frontend de readiness ya no declara DEMO_READY.
Criterio de verificacion: check-branding.ps1 cubre estos documentos fuente y frontend/src/lib/api/types.ts contra DEMO_READY, demo vendible, demo premium, demo tecnica, credenciales demo, seeders demo y producto vendible.

## 2026-06-05 - Recibo institucional sin marcas internas de reglas
Contexto: el recibo impreso podia mostrar una insignia 'Regla' cuando una linea aplicaba una regla especial, aunque el comprobante del paciente no debe exponer codigos ni detalles tecnicos internos.
Decision: GenerateReceiptDataAction ya no entrega special_rule_applied en items de recibo y ReceiptPreview no renderiza marcas de regla. La auditoria de factura conserva la regla en invoice_items y endpoints operativos donde corresponde.
Criterio de verificacion: CashPaymentsReceiptTest exige ausencia de scan_code/barcode/qr_code/special_rule_code/special_rule_applied en items de recibo; ReceiptPreview.test simula campos tecnicos historicos y verifica que no se imprimen.

## 2026-06-05 - Nueva factura filtra servicios por area
Contexto: el flujo de caja necesita ubicar servicios cobrables por area como laboratorio o rayos X sin abrir modulos clinicos ni mezclar catalogo completo en cada busqueda.
Decision: Nueva factura carga areas activas, permite seleccionar Todas o un area, filtra localmente los servicios visibles y envia area_id al endpoint de servicios cuando el cajero busca o cambia filtros. Limpiar vuelve busqueda, area y categoria a Todos.
Criterio de verificacion: ServiceSearch.test cubre filtro y limpieza por area; reducer.test cubre carga de areas, seleccion y reset del filtro.

## 2026-06-05 - Documentacion vigente solo promueve recibo institucional de pagina
Contexto: el objetivo de entrega al Hospital San Isidro exige recibos institucionales tipo talonario en media carta, carta o A5, sin promover formatos de rollo ni 80mm/58mm en guias vigentes.
Decision: los documentos operativos actuales y criterios de aceptacion listan solo media carta, carta y A5. Los valores heredados 80mm/58mm pueden seguir normalizandose internamente donde existan datos antiguos, pero no son formatos operativos promovidos al personal.
Criterio de verificacion: check-branding.ps1 revisa documentos vigentes, guiones de validacion y pruebas de evidencia contra thermal printer, impresora de rollo, 80mm y 58mm.

## 2026-06-05 - Auditoria muestra formatos de recibo con etiquetas institucionales
Contexto: el reporte de Auditoria podia mostrar el valor tecnico del formato de reimpresion, por ejemplo half_letter, en una pantalla administrativa usada para supervision y auditoria.
Decision: AuditoriaTab usa receiptPaperSizeLabel para mostrar Media carta, Carta o A5. Valores heredados o malformados se normalizan a Media carta en la UI, manteniendo compatibilidad historica sin promover formatos de rollo.
Criterio de verificacion: AuditoriaTab.test cubre formatos half_letter, letter, a5 y un valor heredado, y verifica que no se rendericen half_letter, 80mm ni 58mm.

## 2026-06-05 - Evidencia final de impresora solo exige formatos institucionales de pagina

Contexto: la meta de entrega al Hospital San Isidro pide recibos tipo talonario en media carta, carta o A5, y no promover papel de rollo como formato operativo. Algunas superficies de handoff y mocks E2E seguian mencionando 80mm/58mm como bloqueantes de impresora fisica.

Decision: el contrato vigente de evidencia final de impresora queda alineado a media carta, carta y A5. Los valores heredados 80mm/58mm pueden seguir normalizandose internamente para datos antiguos, pero no son requisito operativo ni texto de cierre RC.

Criterio de verificacion: check-branding.ps1 ahora cubre production-readiness E2E, OPERATIONS_OBJECTIVE_AUDIT, FINAL_FIELD_BLOCKERS_SAFETY y PRODUCTION_READINESS_GAP_REPORT contra impresora de rollo, thermal printer, 80mm y 58mm.

## 2026-06-05 - Browser smoke evidence regenerada para la RC actual

Contexto: el objetivo de presentacion exige capturas de navegador y evidencia visual para decidir y entregar la RC. La evidencia previa de browser smoke seguia apuntando a 2026-06-03, antes de las correcciones recientes de recibos y handoff.

Decision: se genero una nueva evidencia mockeada en qa/browser-smoke-2026-06-05 y validate_browser_smoke_evidence.ps1 ahora valida ese reporte como la evidencia local vigente. La evidencia sigue declarando que no sustituye pruebas fisicas LAN, MySQL/MariaDB ni impresora.

Criterio de verificacion: validate_browser_smoke_evidence.ps1 exige el JSON y capturas nuevas, sin console_issues y con nota de no sustitucion fisica; validate_operations_objective_audit.ps1 apunta al reporte 2026-06-05.

## 2026-06-05 - Fechas institucionales completas en recibos impresos

Contexto: la evidencia visual del recibo RC mostraba fecha con anio de dos digitos y formato corto regional, por ejemplo 5/6/26, que puede ser ambiguo para auditoria y archivo fisico.

Decision: el recibo institucional imprime la fecha de emision como DD/MM/YYYY HH:mm y el vencimiento fiscal como DD/MM/YYYY. Las fechas sin hora se normalizan a mediodia local antes de formatear para evitar corrimientos por zona horaria.

Criterio de verificacion: ReceiptPreview.test exige anio de cuatro digitos y hora no ambigua; la evidencia qa/browser-smoke-2026-06-05 muestra el recibo actualizado en media carta, carta, A5 y modo oscuro.

## 2026-06-05 - Recibo rotula el metodo de pago

Contexto: el objetivo institucional exige que el recibo muestre el metodo de pago para que caja, administracion y auditoria puedan leer una copia fisica sin inferir datos de la seccion de pagos.

Decision: la seccion Pagos del recibo institucional incluye encabezados Metodo de pago y Monto antes de listar efectivo, transferencia, tarjeta u otro metodo con cajero/referencia cuando aplique.

Criterio de verificacion: ReceiptPreview.test verifica que el recibo renderiza Metodo de pago y el metodo humano Efectivo junto al cajero.

## 2026-06-05 - Breadcrumbs operativos institucionales

- Las rutas internas pueden mantener nombres tecnicos como /backups para compatibilidad, pero el breadcrumb visible debe usar lenguaje institucional para personal no tecnico.
- Se agrego cobertura unitaria para Respaldos, Configuracion/Datos fiscales y Nueva factura.

## 2026-06-05 - Respaldos sin nombres SQL visibles

- La pantalla normal de respaldos muestra etiquetas humanas como Respaldo manual o Respaldo automatico con fecha, no filenames .sql.
- El filename real se conserva solo para la descarga del archivo y no se usa como mensaje operativo visible.
- BackupsView.a11y.test protege que la lista, el dialogo y el mensaje de descarga no expongan .sql al operador.

## 2026-06-05 - Ayuda muestra evidencia de soporte sin rutas API

- La evidencia local de Ayuda convierte acciones, modulos, rutas y referencias tecnicas a etiquetas humanas como Conexion local, Ayuda y Aviso del sistema.
- El resumen seguro ya no rotula Codigo tecnico ni muestra rutas /api o pantallas crudas al operador.
- clientIssueLog.test y HelpView.test protegen que el panel no exponga rutas internas, secretos ni detalles de runtime.

## 2026-06-05 - Auditoria muestra respaldos sin nombres SQL
La vista de Auditoria en Reportes ahora reutiliza etiquetas institucionales de respaldos para mostrar Respaldo manual o Respaldo automatico con estado Protegido, Pendiente o Error, sin exponer nombres de archivo .sql al personal. El nombre real del archivo queda reservado para descarga, auditoria interna y backend, mientras la interfaz normal mantiene lenguaje operativo verificable.
Pruebas actualizadas: AuditoriaTab y ReportsView bloquean la aparicion visible de hospital-backup, .sql o filename; BackupsView conserva las mismas etiquetas mediante el helper compartido.

## 2026-06-07 - Capacitacion y manual de operador sin estados internos de respaldo
La guia rapida de administrador y el indice de operador ahora usan lenguaje visible de producto para respaldos: Protegido, Pendiente y Error. Se removieron rutas de verificacion, comandos de API y comandos de mantenimiento del indice normal para que caja y administracion trabajen desde UI o escalen a soporte local.
Validadores actualizados: validate_training_safety bloquea pending, success, failed, checksum, SHA256 y rutas crudas en TRAINING_ADMIN; validate_operator_manuals_safety bloquea curl, /api/, php artisan y duda tecnica en manuales normales.

## 2026-06-07 - Runbook de incidentes usa estados visibles para respaldos pendientes
El incidente comun de respaldos pendientes ahora habla en terminos de producto: Pendiente, Protegido y Error. Se retiro de esa seccion el lenguaje interno pending, success, failed, worker_recently_active y HOSPITAL_DUMP_BINARY para que supervisor y soporte de primer nivel indiquen acciones claras sin exponer detalles de implementacion al operador.
El validador de manuales ahora lee RUNBOOK_INCIDENTES_COMUNES y bloquea la reaparicion de esos estados internos en la seccion de respaldo pendiente.

## 2026-06-07 - Runbook evita comandos crudos en pantalla blanca y checklist final
Las secciones Pantalla blanca y Cuando todo falla del runbook de incidentes comunes ahora guian al operador por direccion LAN oficial, cache del navegador, resumen seguro de Ayuda y escalamiento a soporte local. Se retiraron comprobaciones visibles con /up, /api, docker ps, curl, JSON y localhost:8000 de esas secciones para no trasladar diagnostico tecnico a caja o supervision.
El validador validate_operator_manuals_safety extrae ambas secciones y bloquea la reaparicion de rutas, comandos o checks de runtime crudos en esos pasos.

## 2026-06-07 - Runbook humaniza error de herramienta local de respaldo
El incidente de respaldo por driver o binario faltante ahora se presenta como Respaldo muestra Error por herramienta local. La guia evita docker exec, HOSPITAL_DUMP_BINARY, nombres de binarios y .env en la seccion para operador/supervisor, y dirige a revisar estado visible, espacio en disco, resumen seguro de Ayuda y escalamiento a soporte local.
validate_operator_manuals_safety extrae esta seccion y bloquea la reaparicion de comandos, variables o rutas internas del servidor en ese incidente.

## 2026-06-07 - Runbook humaniza sesion cerrada inesperadamente
La seccion Sesion cerrada inesperadamente ahora evita variables de sesion, comandos artisan, backend y .env. El flujo guia al cajero a reintentar ingreso, avisar al supervisor si se repite, preparar resumen seguro desde Ayuda y escalar a soporte local para revisar configuracion de sesiones sin exponer secretos.
validate_operator_manuals_safety extrae la seccion y bloquea la reaparicion de SESSION_DRIVER, SESSION_ENCRYPT, SANCTUM_STATEFUL_DOMAINS, session:clear, php artisan, runtime y .env en ese incidente.
