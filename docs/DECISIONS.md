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

- Fase 8 registra `backup_logs`, crea backups locales con `php artisan hospital:backup` y permite al admin listar, crear y descargar archivos registrados.
- Los archivos se guardan en el disco local bajo `storage/app/private/backups`; no se suben a cloud ni se exponen rutas arbitrarias.
- La descarga valida permiso `backups.download`, estado `success`, ruta relativa segura, existencia del archivo y pertenencia a la carpeta de backups.
- Restore queda como procedimiento manual documentado en `docs/BACKUP_RESTORE.md`, primero en entorno de prueba y nunca como boton destructivo en UI.

Motivo:

- En operacion offline LAN el hospital necesita respaldos verificables sin depender de internet.
- Restore desde UI puede destruir datos de caja/facturacion por error y requiere parada controlada.

Consecuencia:

- Admin puede operar backup manual y descargarlo para copia local/USB.
- Produccion debe instalar `mariadb-dump` o `mysqldump` local para dumps reales de MySQL/MariaDB.
- Si falta la herramienta de dump, el backup queda registrado como `failed` sin exponer credenciales en logs.
