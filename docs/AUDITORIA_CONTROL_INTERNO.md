# Auditoria y control interno

## Objetivo

Este frente fortalece el Sistema de Caja Hospitalaria para que las acciones sensibles de caja, facturacion, pagos, recibos, configuracion, usuarios y respaldos queden trazables. La meta es poder responder quien hizo una accion, cuando, sobre que registro, desde que equipo, con que resultado y con que motivo cuando aplica.

## Modelo de auditoria

La tabla `audit_logs` registra eventos de control interno con estos datos:

- `user_id`: usuario autenticado, cuando existe.
- `action`: accion normalizada, por ejemplo `payment.voided`.
- `result`: `success` o `failed`.
- `entity_type` y `entity_id`: entidad afectada.
- `old_values` y `new_values`: valores importantes antes/despues.
- `reason`: motivo obligatorio o explicacion cuando aplica.
- `ip_address` y `user_agent`: origen LAN/dispositivo si esta disponible.
- `created_at`: fecha y hora del evento.

La escritura nueva debe pasar por `App\Support\AuditLogger` cuando la accion ocurre desde un request HTTP. Los jobs o comandos locales pueden registrar eventos sin IP/dispositivo cuando no exista request.

## Roles y permisos

- `admin`: administra configuracion fiscal, usuarios, catalogo, reportes, backups y acciones criticas.
- `supervisor`: revisa reportes, cierra cajas, autoriza anulaciones y revierte pagos con motivo.
- `cajero`: abre caja, emite facturas, registra pagos y reimprime recibos permitidos.
- `auditor`: consulta reportes, historial, auditoria y respaldos, sin operar caja ni facturar.
- `soporte_tecnico`: consulta diagnostico tecnico, sin manipular caja, facturas, fiscal ni backups.

El backend valida permisos con Form Requests, policies o checks de permiso. Ocultar botones en React no cuenta como control de seguridad.

## Eventos cubiertos

- `auth.login_success`
- `auth.login_failed`
- `cash_session.opened`
- `cash_session.closed`
- `cash_session.difference`
- `invoice.issued`
- `invoice.voided`
- `invoice.void_blocked_paid`
- `payment.registered`
- `payment.voided`
- `invoice.reprinted`
- `fiscal_settings.created`
- `fiscal_settings.updated`
- `fiscal_sequence.created`
- `fiscal_sequence.updated`
- `category.created`
- `category.updated`
- `service.created`
- `service.updated`
- `service.price_updated`
- `service.active_updated`
- `user.created`
- `user.updated`
- `user.activated`
- `user.deactivated`
- `user.password_reset`
- `user.password_changed`
- `backup.requested`
- `backup.created`
- `backup.downloaded`

## Facturas, pagos y recibos

- Las facturas emitidas no se borran.
- Los items de factura usan snapshots historicos.
- Una anulacion requiere permiso y motivo.
- Una factura con pagos no se anula directamente; primero debe existir un flujo de reversion de pago.
- La reversion de pago marca el pago como `void`, guarda `void_reason`, ajusta saldo/estado de factura, crea movimiento de caja negativo y registra `payment.voided`.
- La reimpresion usa snapshots y registra `invoice.reprinted`.

## Caja

- No se emite factura sin caja abierta.
- No se registra pago sin caja activa propia.
- El cierre calcula efectivo esperado solo con pagos en efectivo.
- Tarjeta, transferencia y otros metodos no aumentan efectivo esperado.
- Toda diferencia requiere nota y genera `cash_session.difference`.

## Reporte de auditoria

La pestana **Auditoria** en Reportes permite consultar por rango:

- anulaciones;
- reimpresiones;
- eventos de control;
- respaldos;
- actividad de cajeros.

El acceso esta restringido a roles con permisos de reportes/auditoria. Los cajeros normales no ven tecnicismos ni historial gerencial.

## Backups y restore

- Los backups manuales y programados quedan en `backup_logs`.
- Cada backup solicitado o creado queda auditado.
- La descarga de backup queda auditada.
- No existe endpoint de restore destructivo.
- Toda restauracion real debe probarse antes en base descartable y documentarse con checksum, fecha, responsable y resultado.

## Operacion ante errores

- Si un cajero se equivoca al cobrar, debe avisar a supervisor. El supervisor revierte el pago con motivo y luego decide si corresponde anular factura.
- Si hay diferencia de caja, el cierre requiere nota clara y se revisa en Reportes > Auditoria.
- Si falla un backup, administracion revisa Backups y diagnostico tecnico antes de declarar cierre completo.
