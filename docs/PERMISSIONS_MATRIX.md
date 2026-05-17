# Permissions Matrix - Hospital Billing OS Offline

## Roles

- `admin`: administra sistema, usuarios, configuracion, catalogo, reportes, backups y acciones criticas.
- `supervisor`: supervisa operacion, reportes, caja, anulaciones y reimpresiones.
- `cajero`: opera facturacion, caja propia, pagos y reimpresion limitada.

El backend debe validar todos los permisos con Policies/Gates o middleware equivalente. Ocultar botones en el frontend no cuenta como seguridad.

## Matriz por modulo

| Modulo / Accion | Permiso | admin | supervisor | cajero |
|---|---|---:|---:|---:|
| Ver configuracion fiscal | `settings.fiscal.view` | Si | Si | No |
| Editar configuracion fiscal | `settings.fiscal.update` | Si | No | No |
| Ver catalogo | `catalog.view` | Si | Si | Si |
| Crear/editar categorias | `catalog.manage` | Si | Si | No |
| Crear/editar servicios/precios | `catalog.manage` | Si | Si | No |
| Ver facturas | `invoices.view` | Si | Si | Si, propias/dia por defecto |
| Crear facturas | `invoices.create` | Si | Si | Si |
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
| Ver reportes | `reports.view` | Si | Si | No |
| Exportar reportes | `reports.export` | Si | Si | No |
| Ver usuarios/roles | `users.view` | Si | No | No |
| Crear usuarios | `users.create` | Si | No | No |
| Editar usuarios/roles | `users.update` | Si | No | No |
| Desactivar usuarios | `users.disable` | Si | No | No |
| Ver backups | `backups.view` | Si | No | No |
| Crear backup manual | `backups.create` | Si | No | No |
| Descargar backup | `backups.download` | Si | No | No |
| Ver auditoria | `audit.view` | Si | Si | No |

## Reglas de alcance por rol

### Admin

- Puede configurar datos fiscales, hospital, recibo, roles, usuarios y backups.
- Puede anular facturas/pagos con motivo.
- Puede ver reportes y auditoria completa.
- No debe borrar facturas ni pagos; solo anular.

### Supervisor

- Puede gestionar catalogo si el hospital delega esa operacion.
- Puede ver reportes y cajas.
- Puede anular facturas/pagos con motivo.
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

## Acciones criticas que siempre requieren auditoria

- Cambios en configuracion fiscal.
- Cambios de precio o activacion/desactivacion de servicios.
- Creacion de factura.
- Registro o anulacion de pago.
- Anulacion de factura.
- Cierre de caja.
- Reimpresion de factura.
- Creacion/descarga de backup.
- Cambios de roles/permisos.

