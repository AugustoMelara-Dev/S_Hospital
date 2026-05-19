# Technical Decisions - Hospital Billing OS Offline

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

### 2026-05-17 - Caja, pagos y recibo termico MVP

Decision:

- Caja usa `cash_register_sessions` con una caja abierta maxima por cajero validada transaccionalmente en backend.
- La unicidad real de caja abierta se defiende tambien en base de datos con `open_user_id` nullable y unico: solo las cajas abiertas llenan ese campo, y las cajas cerradas lo dejan `NULL` para permitir historico.
- Registro de pago guarda `payments`, `cash_movements` y actualiza `invoices.paid_amount`, `invoices.balance_due` y `invoices.status` dentro de una sola transaccion.
- `expected_amount` de cierre representa efectivo esperado: monto inicial mas pagos en efectivo registrados en la caja.
- El recibo MVP devuelve datos renderizables para 80mm/58mm y usa exclusivamente snapshots de `invoice_items` junto con datos fiscales persistidos.

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

- Fase 10 separa el estado `DEMO_READY`, `PRODUCTION_CANDIDATE` y `PRODUCTION_READY`.
- Playwright E2E queda como gate separado en `scripts/e2e_gate.sh`, no mezclado dentro del quality gate seguro.
- Restore MySQL/MariaDB real y concurrencia MySQL/MariaDB real quedan como scripts verificables (`scripts/validate_restore_mysql.sh` y `scripts/validate_mysql_concurrency.sh`) que requieren banderas explicitas antes de tocar entornos reales.
- Produccion same-origin desde Laravel sirve `/`, `/login`, `/verify-email` y `/assets/*` desde `frontend/dist` para que los clientes LAN puedan entrar por IP o nombre del servidor.
- Impresora termica fisica no se marca validada sin hardware; queda checklist operativo en `docs/THERMAL_PRINTER_VALIDATION.md`.

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
- Impresora termica 80mm/58mm solo se marca validada con hardware real.

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
