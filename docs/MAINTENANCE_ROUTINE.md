# Rutina de Mantenimiento Local - S_Hospital (subagente 28)

## Proposito

Definir como mantener el sistema despues de entregado, para que el hospital sea autonomo y no dependa del desarrollador para tareas operativas recurrentes.

## Responsables

- **Responsable tecnico**: persona designada por el hospital con conocimiento del sistema. Realiza o supervisa el mantenimiento.
- **Cajero lider**: apoya en la revision diaria de caja.
- **Director o administrador del hospital**: firma las revisiones mensuales.

## Checklist diario (responsable: cajero lider o tecnico)

- [ ] Sistema responde en `http://IP-DEL-SERVIDOR` desde al menos una estacion.
- [ ] `/up` responde 200.
- [ ] `/login` carga sin errores.
- [ ] Al menos un cajero pudo iniciar sesion.
- [ ] Caja del dia se abrio sin novedad.
- [ ] No hay alertas rojas en panel de Respaldos (badges de `failed`).
- [ ] Ultimo backup visible en UI con timestamp del dia o ayer.
- [ ] Impresora responde a una impresion de prueba (recibo de prueba).
- [ ] No hay errores visibles en consola del navegador (F12) al facturar.

Si algun item falla, escalar al responsable tecnico antes de continuar facturando.

## Checklist semanal (responsable: tecnico)

- [ ] Revisar espacio en disco del servidor (`Get-Volume` o `df -h`); libre >= 20% del total.
- [ ] Confirmar que el backup automatico de la noche anterior finalizo en `success`.
- [ ] Confirmar que el worker de cola `backups` esta corriendo (tarea Windows o servicio Docker `queue-worker`).
- [ ] Revisar `backend/storage/logs/laravel.log` por errores recurrentes.
- [ ] Revisar `install-logs/` por alertas.
- [ ] Probar la conexion de una estacion cliente por IP (no por localhost).
- [ ] Validar que la fecha/hora del servidor es correcta.
- [ ] Confirmar que la puerta del cuarto del servidor esta cerrada con llave.
- [ ] Limpiar archivos temporales de impresion fallida o PDFs en estacion de caja.

## Checklist mensual (responsable: tecnico + director)

- [ ] Rotar USB de respaldo a caja fuerte externa (directivo o designado).
- [ ] Restaurar el ultimo backup en una base descartable (`hospital_restore_validation`) y validar conteos minimos (ver `docs/BACKUP_RESTORE.md`).
- [ ] Revisar usuarios activos: desactivar usuarios que ya no laboran en el hospital.
- [ ] Cambiar contrasena del admin si han pasado 90 dias o si hay sospecha de compromiso.
- [ ] Revisar `audit_logs` por acciones inusuales (anulaciones, reimpresiones, cambios de configuracion).
- [ ] Confirmar que el sistema operativo del servidor tiene parches criticos aplicados.
- [ ] Confirmar que el antivirus del servidor y estaciones esta activo y actualizado.
- [ ] Validar que el paquete `offline-release/` esta actualizado al commit actual del codigo.

## Checklist trimestral (responsable: tecnico)

- [ ] Prueba de impresion fisica en hardware real (los 5 formatos si aplica: carta, media carta, A5, 80mm, 58mm).
- [ ] Verificar IPs fijas configuradas en servidor y router (no se hayan movido por DHCP).
- [ ] Confirmar que el firewall de Windows/Linux sigue con la configuracion aprobada.
- [ ] Revisar y archivar logs antiguos (`hospital:prune-audit-logs`, `hospital:prune-failed-jobs`).
- [ ] Validar que la documentacion de contacto de soporte este vigente.

## Procedimiento de reporte de errores

1. Cajero o tecnico detecta un error.
2. Capturar pantalla (sin datos sensibles: borrar nombre de paciente o monto en la captura).
3. Anotar fecha, hora, usuario, accion que se realizaba y mensaje de error exacto.
4. Guardar log si esta disponible (`backend/storage/logs/laravel.log` o `install-logs/`).
5. Escalar al responsable tecnico por canal acordado (telefono, mensaje, ticket).
6. Si el error bloquea facturacion, seguir `docs/DISASTER_RECOVERY.md` escenario correspondiente.

## Procedimiento para soporte tecnico

- Contacto primario: responsable tecnico del hospital.
- Contacto secundario: proveedor del sistema (definir en el contrato de entrega).
- Tiempo de respuesta objetivo: definido en el contrato.
- Para incidentes de datos (restore, corrupcion): aplicar `docs/DISASTER_RECOVERY.md` y documentar en `qa/INCIDENT-YYYY-MM-DD.md`.

## Indicadores de salud del sistema

- `GET /api/system/health` (publico) retorna estado del sistema, conexiones DB, profundidad de cola, estado del backup worker.
- La UI de Backups muestra badge "Worker activo/inactivo" basado en el heartbeat del backup worker.
- `GET /api/system/openapi` (publico) documenta la API para integraciones futuras.

## Criterio de listo

- El hospital sabe que hacer despues de la entrega, no solo el dia de la instalacion.
- Existe un calendario de mantenimiento visible para el responsable tecnico.
- Los incidentes se documentan en `qa/INCIDENT-YYYY-MM-DD.md` con causa, accion y resultado.
- La autonomia operativa es verificable: el hospital puede pasar una semana sin intervencion del proveedor.
