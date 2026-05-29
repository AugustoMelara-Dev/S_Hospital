# Manual del administrador

Guia para administracion, supervision y soporte operativo local del Hospital San Isidro.

## Responsabilidades

- Mantener datos del hospital y recibo institucional.
- Administrar usuarios y permisos.
- Revisar reportes, caja, anulaciones y reimpresiones.
- Verificar respaldos.
- Coordinar instalacion, impresora, red local y restauraciones seguras.

## Configuracion del hospital

Revise en **Configuracion fiscal/hospitalaria**:

- Nombre oficial del hospital.
- RTN si aplica.
- Direccion y lugar de emision.
- Lineas de Gobierno, Secretaria y Hospital.
- Serie, rango, CAI y fecha limite si existen datos reales.
- Tamano de papel autorizado: carta, media carta o A5.

No invente CAI, serie, rango ni fecha limite. Si faltan datos reales, el sistema debe indicar configuracion pendiente.

## Usuarios y permisos

Use una cuenta por persona.

- Cajero: abrir/cerrar caja propia, facturar, cobrar e imprimir.
- Supervisor: revisar caja, historial, reportes, reimpresiones y anulaciones autorizadas.
- Administrador: configurar sistema, usuarios, reportes, respaldos y datos fiscales.

Desactive usuarios que ya no trabajen en caja. No reutilice cuentas entre turnos.

## Catalogo

Revise periodicamente:

- Servicios activos.
- Precio vigente.
- Categoria correcta.
- Regla de eritropoyetina.
- Servicios inactivos que no deben venderse.

Los recibos y facturas historicas conservan snapshot de nombre y precio. Cambiar catalogo no debe alterar facturas anteriores.

## Caja y anulaciones

- Toda factura pagada queda asociada a caja, cajero, metodo y fecha.
- Toda anulacion requiere permiso, motivo y auditoria.
- No borre facturas.
- Si hay saldo parcial, resuelva el saldo antes de cerrar caja.
- Tarjeta y transferencia se revisan por reportes; no se cuentan como efectivo en gaveta.

## Reportes diarios

Revise:

- Facturado.
- Cobrado.
- Saldo pendiente.
- Pagadas, parciales, emitidas y anuladas.
- Cobros por metodo.
- Diferencias de caja.
- Reimpresiones y anulaciones.

Use estos reportes para cierre del dia y conciliacion con caja fisica.

## Respaldos

Todos los dias confirme:

1. Existe respaldo reciente.
2. Esta completado.
3. Tiene tamano mayor a cero.
4. Muestra huella SHA256.
5. Hay copia externa segura cuando corresponda.

Antes de actualizaciones o cambios de configuracion importante:

1. Crear respaldo manual.
2. Confirmar completado y verificado.
3. Descargar o copiar a medio externo autorizado.
4. Registrar quien hizo el cambio y por que.

## Restauracion

No restaure directo sobre produccion desde el navegador. El sistema no ofrece boton de restauracion por seguridad.

Restaurar requiere:

1. Autorizacion administrativa.
2. Parar operacion de caja.
3. Crear respaldo nuevo del estado actual.
4. Validar el respaldo elegido en una base descartable.
5. Documentar fecha, archivo, huella, responsable y resultado.

## Antes de entregar el sistema a operacion

- Login probado.
- Caja abierta/cerrada.
- Factura creada, cobrada e impresa.
- Reimpresion probada.
- Reporte diario revisado.
- Respaldo manual completado y verificado.
- Acceso desde otra PC en LAN probado.
- Impresora fisica probada con recibo institucional.
- Reinicio de Windows probado.
