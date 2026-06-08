# Permissions Matrix - Sistema de Caja Hospitalaria

## Roles

- `admin`: administra sistema, usuarios, configuracion, catalogo, reportes, backups y acciones criticas.
- `supervisor`: supervisa operacion, reportes, caja, anulaciones y reimpresiones.
- `cajero`: opera facturacion, caja propia, pagos y reimpresion limitada.
- `area`: consulta servicios pagados de su area asignada; no opera caja, no crea facturas y no ve reportes gerenciales.

El backend debe validar todos los permisos con Policies/Gates o middleware equivalente. Ocultar botones en el frontend no cuenta como seguridad.

## Matriz por modulo

| Modulo / Accion | Permiso | admin | supervisor | cajero | area |
|---|---|---:|---:|---:|---:|
| Ver configuracion fiscal | `settings.fiscal.view` | Si | Si | No | No |
| Editar configuracion fiscal | `settings.fiscal.update` | Si | No | No | No |
| Ver catalogo | `catalog.view` | Si | Si | Si | No |
| Crear/editar categorias | `catalog.manage` | Si | Configurable | No | No |
| Crear/editar servicios/precios | `catalog.manage` | Si | Configurable | No | No |
| Ver facturas | `invoices.view` | Si | Si | Si, propias/dia por defecto | No |
| Crear facturas | `invoices.create` | Si | Si | Si | No |
| Operar cualquier factura para cobro/reversion | `invoices.operate_any` | Si | Si | No | No |
| Anular facturas | `invoices.void` | Si | Si | No | No |
| Ver caja | `cash.view` | Si | Si | Si, caja propia | No |
| Abrir caja | `cash.open` | Si | Si | Si | No |
| Cerrar caja | `cash.close` | Si | Si | Si, caja propia | No |
| Cerrar caja de otro usuario | `cash.close_any` | Si | Si | No | No |
| Registrar pagos | `payments.create` | Si | Si | Si | No |
| Ver pagos | `payments.view` | Si | Si | Si, propios/dia por defecto | No |
| Anular pagos | `payments.void` | Si | Si | No | No |
| Ver recibos | `receipts.view` | Si | Si | Si | No |
| Reimprimir recibos | `receipts.reprint` | Si | Si | Si, propias/dia por defecto | No |
| Reimprimir facturas antiguas/de otros | `receipts.reprint_any` | Si | Si | No | No |
| Ver navegacion de reportes | `reports.view` | Si | Si | No | No |
| Ver reportes gerenciales | `reports.managerial.view` | Si | Si | No | No |
| Ver reporte de caja propia | `reports.cash_session.view` | Si | Si | Configurable | No |
| Exportar reportes | `reports.export` | Si | Si | No | No |
| Ver usuarios/roles | `users.view` | Si | No | No | No |
| Crear usuarios | `users.create` | Si | No | No | No |
| Editar usuarios/roles | `users.update` | Si | No | No | No |
| Desactivar usuarios | `users.disable` | Si | No | No | No |
| Ver backups | `backups.view` | Si | No | No | No |
| Crear backup manual | `backups.create` | Si | No | No | No |
| Descargar backup | `backups.download` | Si | No | No | No |
| Ver auditoria | `audit.view` | Si | Si | No | No |

## Consulta por area

| Accion | Permiso | admin | supervisor | cajero | area |
|---|---|---:|---:|---:|---:|
| Consultar servicios pagados de su area | `areas.paid_services.view` | Si | Si | No | Si, solo area asignada |

## Reglas de alcance por rol

### Admin

- Puede configurar datos fiscales, hospital, recibo, roles, usuarios y backups.
- Puede anular facturas/pagos con motivo.
- Puede operar facturas fuera de su propia caja/dia mediante `invoices.operate_any`.
- Puede ver reportes y auditoria completa.
- No debe borrar facturas ni pagos; solo anular.

### Supervisor

- Puede gestionar catalogo/precios solo si el hospital lo autoriza. En validacion controlada puede estar permitido, pero debe ser un permiso configurable, no una regla fija del rol.
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

### Area

- Puede consultar servicios pagados solo de su area asignada mediante `areas.paid_services.view`.
- No puede abrir caja, crear facturas, registrar pagos, anular, reimprimir, ver reportes gerenciales, administrar usuarios ni gestionar respaldos.
- Requiere `area_id` asignado por administracion antes de operar.
- No debe usarse como modulo clinico ni expediente; solo confirma servicios cobrados.

## Acciones criticas que siempre requieren auditoria

- Cambios en configuracion fiscal.
- Cambios de precio o activacion/desactivacion de servicios.
- Creacion de factura.
- Registro o anulacion de pago.
- Anulacion de factura.
- Apertura de caja.
- Cierre de caja.
- Reimpresion de factura.
- Creacion/descarga de backup.
- Cambios de roles/permisos.

## Decision de producto sobre catalogo

Por defecto, `admin` siempre puede gestionar catalogo y precios. `supervisor` puede recibir `catalog.manage` si el hospital delega esa responsabilidad; para validacion controlada puede estar habilitado, pero el backend siempre debe validar el permiso real `catalog.manage`. El rol `cajero` no gestiona catalogo ni precios.
