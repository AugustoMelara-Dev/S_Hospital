# Permissions Matrix - Sistema de Caja Hospitalaria

## Roles

- `admin`: administra sistema, usuarios, configuracion, catalogo, reportes, backups y acciones criticas.
- `supervisor`: supervisa operacion, reportes, caja, anulaciones y reimpresiones.
- `cajero`: opera facturacion, caja propia, pagos y reimpresion limitada.
- `auditor`: consulta reportes, historial, auditoria y respaldos sin operar caja ni facturar.
- `soporte_tecnico`: consulta diagnostico tecnico sin permisos de caja, facturacion, fiscal o backups.

El backend debe validar todos los permisos con Policies/Gates o middleware equivalente. Ocultar botones en el frontend no cuenta como seguridad.

## Matriz por modulo

| Modulo / Accion | Permiso | admin | supervisor | cajero |
|---|---|---:|---:|---:|
| Ver configuracion fiscal | `settings.fiscal.view` | Si | Si | No |
| Editar configuracion fiscal | `settings.fiscal.update` | Si | No | No |
| Ver catalogo | `catalog.view` | Si | Si | Si |
| Crear/editar categorias | `catalog.manage` | Si | Configurable | No |
| Crear/editar servicios/precios | `catalog.manage` | Si | Configurable | No |
| Ver facturas | `invoices.view` | Si | Si | Si, propias/dia por defecto |
| Crear facturas | `invoices.create` | Si | Si | Si |
| Operar cualquier factura para cobro/reversion | `invoices.operate_any` | Si | Si | No |
| Anular facturas | `invoices.void` | Si | Si | No |
| Ver caja | `cash.view` | Si | Si | Si, caja propia |
| Abrir caja | `cash.open` | Si | Si | Si |
| Cerrar caja | `cash.close` | Si | Si | Si, caja propia |
| Cerrar caja de otro usuario | `cash.close_any` | Si | Si | No |
| Registrar pagos | `payments.create` | Si | Si | Si |
| Ver pagos | `payments.view` | Si | Si | Si, propios/dia por defecto |
| Anular pagos | `payments.void` | Si | Si | No |
| Ver recibos | `receipts.view` | Si | Si | Si |
| Reimprimir recibos | `receipts.reprint` | Si | Si | Si, propias/dia por defecto |
| Reimprimir facturas antiguas/de otros | `receipts.reprint_any` | Si | Si | No |
| Ver navegacion de reportes | `reports.view` | Si | Si | No |
| Ver reportes gerenciales | `reports.managerial.view` | Si | Si | No |
| Ver reporte de caja propia | `reports.cash_session.view` | Si | Si | Configurable |
| Exportar reportes | `reports.export` | Si | Si | No |
| Ver usuarios/roles | `users.view` | Si | No | No |
| Crear usuarios | `users.create` | Si | No | No |
| Editar usuarios/roles | `users.update` | Si | No | No |
| Desactivar usuarios | `users.disable` | Si | No | No |
| Ver backups | `backups.view` | Si | No | No |
| Crear backup manual | `backups.create` | Si | No | No |
| Descargar backup | `backups.download` | Si | No | No |
| Ver auditoria | `audit.view` | Si | Si | No |
| Ver diagnostico tecnico | `system.status.view` | Si | No | No |

## Reglas de alcance por rol

### Admin

- Puede configurar datos fiscales, hospital, recibo, roles, usuarios y backups.
- Puede anular facturas/pagos con motivo.
- Puede operar facturas fuera de su propia caja/dia mediante `invoices.operate_any`.
- Puede ver reportes y auditoria completa.
- No debe borrar facturas ni pagos; solo anular.

### Supervisor

- Puede gestionar catalogo/precios solo si el hospital lo autoriza. En demo puede estar permitido, pero debe ser un permiso configurable, no una regla fija del rol.
- Puede ver reportes y cajas.
- Puede anular facturas/pagos con motivo.
- Puede operar facturas fuera de su propia caja/dia mediante `invoices.operate_any`.
- Puede reimprimir facturas historicas.
- No puede editar configuracion fiscal ni usuarios.
- No puede descargar backups.

### Cajero

- Puede abrir y cerrar su caja.
- Puede crear facturas y registrar pagos en su caja abierta.
- Puede reimprimir recibos propios del dia.
- No puede editar precios, configuracion fiscal ni usuarios.
- No puede anular facturas/pagos.
- No puede ver reportes gerenciales.

### Auditor/Consulta

- Puede ver reportes, historial, auditoria y registros de backup.
- No puede abrir/cerrar caja, facturar, cobrar, anular, revertir pagos, editar catalogo, fiscal, usuarios ni backups.

### Soporte tecnico

- Puede ver diagnostico tecnico del sistema.
- No puede manipular caja, facturas, pagos, catalogo, configuracion fiscal, usuarios ni backups.

## Acciones criticas que siempre requieren auditoria

- Cambios en configuracion fiscal.
- Cambios de precio o activacion/desactivacion de servicios.
- Creacion de factura.
- Registro o anulacion de pago.
- Reversion/anulacion de pago.
- Anulacion de factura.
- Cierre de caja.
- Reimpresion de factura.
- Creacion/descarga de backup.
- Cambios de roles/permisos.

## Decision de producto sobre catalogo

Por defecto, `admin` siempre puede gestionar catalogo y precios. `supervisor` puede recibir `catalog.manage` si el hospital delega esa responsabilidad; para demo vendible puede estar habilitado, pero el backend siempre debe validar el permiso real `catalog.manage`. El rol `cajero` no gestiona catalogo ni precios.
