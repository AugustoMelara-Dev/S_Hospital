# Politica de Fecha, Hora y Trazabilidad - S_Hospital (subagente 25)

## Proposito

Evitar errores graves por fecha/hora incorrecta en un sistema offline. Cada accion debe quedar registrada con una marca de tiempo confiable.

## Zona horaria

- Zona horaria del hospital: la del pais donde opera el hospital (default `America/Tegucigalpa` para Honduras).
- Configurar en `backend/.env` con `APP_TIMEZONE=America/Tegucigalpa`.
- Configurar en el sistema operativo del servidor: misma zona horaria.
- Configurar en el navegador de los cajeros: permitir que el navegador use la zona horaria del sistema operativo (no fijar zona horaria custom).
- Sincronizar todas las PCs (servidor y estaciones) a la misma zona horaria.

## Hora local del servidor

- El servidor debe tener hora confiable. Opciones:
  1. NTP publico (si hay internet limitado en la red administrativa).
  2. Router local con servidor NTP.
  3. PC del director o responsable con hora manual corregida periodicamente.
- Si no hay NTP disponible, el responsable tecnico verifica y corrige la hora del servidor al menos 1 vez por semana.
- Documentar el metodo de sincronizacion en `docs/INSTALL-YYYY-MM-DD.md` del hospital.

## Timestamps en registros

- `invoices.issued_at`, `payments.created_at`, `cash_sessions.opened_at`, `audit_logs.created_at` y todos los timestamps se almacenan en UTC en la base de datos.
- La conversion a hora local se hace en la capa de presentacion (Blade/React) usando la zona horaria configurada.
- NUNCA guardar timestamps como `string` o `varchar` en la base de datos; usar `timestamp` o `datetime` con conversion explicita.

## Auditoria

- `audit_logs` registra usuario, accion, entidad, fecha/hora (UTC), IP, user agent y resultado (`success`/`failed`).
- Los registros de auditoria son inmutables: no se permite `UPDATE` ni `DELETE` desde la aplicacion.
- Solo el admin con permiso `audit.view` puede consultar la pantalla de Auditoria; nadie puede borrar logs.

## Registros clinicos con fecha/hora

- Si en el futuro se anade historial clinico, la fecha/hora del evento clinico debe poder registrarse aunque difiera de la fecha/hora del sistema (por ejemplo, consulta del 14 de junio anotada el 15 de junio).
- En la fase actual, solo se manejan facturas, pagos y caja; todos llevan la fecha/hora del sistema en el momento del registro.

## Cambios manuales de reloj

- Cambiar la hora del servidor esta PROHIBIDO durante el horario de caja.
- Si se debe corregir la hora del servidor, hacerlo fuera de horario operativo y:
  1. Avisar al director o responsable autorizado.
  2. Crear un backup antes del cambio.
  3. Detener los servicios (backend, queue worker).
  4. Aplicar el cambio.
  5. Verificar que la cola de respaldos y los timestamps son coherentes.
  6. Reiniciar servicios y validar `/up`.
  7. Documentar en `qa/INCIDENT-YYYY-MM-DD.md` con fecha del cambio, hora anterior, hora nueva, motivo y responsable.

## Advertencia de fecha/hora incorrecta

- La pantalla de login muestra la fecha/hora del servidor al lado del campo de usuario.
- Si la diferencia entre la hora del servidor y la hora del navegador del cliente supera 5 minutos, mostrar un banner amarillo: "La hora de esta computadora difiere de la del servidor. Sincronice la hora del sistema operativo para evitar errores en facturas y caja."
- Si la fecha del servidor es anterior a la fecha de la ultima factura emitida, mostrar banner rojo: "La fecha del servidor parece incorrecta. Contacte al responsable tecnico antes de facturar."

## Procedimiento para corregir fecha/hora

1. Confirmar la hora correcta con una fuente externa (celular con datos, reloj oficial, otra PC con internet).
2. Crear backup fresco del sistema.
3. Coordinar con el responsable tecnico.
4. Detener servicios.
5. Corregir fecha/hora del sistema operativo.
6. Reiniciar servicios.
7. Validar `/up`, login, y una factura de prueba.
8. Documentar incidente.

## Criterio de listo

- Cada accion importante (factura emitida, pago, apertura/cierre de caja, cambio de configuracion, login, reimpresion, anulacion) queda registrada con usuario, fecha y hora confiables.
- Una desviacion de mas de 5 minutos entre PCs clientes y servidor se detecta y se muestra al usuario.
- Cambiar la hora del servidor queda registrado en auditoria y exige autorizacion.
