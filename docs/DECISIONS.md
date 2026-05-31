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
