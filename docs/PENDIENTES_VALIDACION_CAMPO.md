# Pendientes de Validacion en Campo

Estos pendientes no son modulos faltantes. Son evidencias fisicas necesarias antes de declarar PRODUCTION_READY.

Estado permitido al cierre F21: `READY_FOR_REAL_LAN_INSTALLATION_TEST`.

## Pendientes obligatorios

1. Servidor final instalado con configuracion production.
   - Evidencia: version instalada, `APP_ENV=production`, `APP_DEBUG=false`, IP/hostname LAN y hora del servidor.
   - Archivo sugerido: `qa/SERVER_INSTALLATION_PROOF.md`.

2. Segunda PC conectada por LAN accediendo por IP/hostname local.
   - Evidencia: captura o acta con URL local, login, dashboard y nueva factura visibles desde cliente.
   - Archivo sugerido: `qa/LAN_CLIENT_VALIDATION_PROOF.md`.

3. Impresora fisica final con papel real y formato institucional validado.
   - Evidencia: recibo fisico firmado para formato configurado, por ejemplo 80mm, 58mm, A5, carta o media carta.
   - Archivo sugerido: `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`.

4. Backup worker o tarea programada corriendo en servidor real.
   - Evidencia: respaldo manual queda `pending` y luego `success`; respaldo automatico diario registrado; scheduler heartbeat reciente.
   - Archivo sugerido: `qa/BACKUP_WORKER_SCHEDULER_PROOF.md`.

5. Restore probado en base descartable usando backup real o representativo.
   - Evidencia: restauracion en base separada, verificacion de login, facturas, pagos, reportes y huella SHA256.
   - Archivo sugerido: `qa/FINAL_RESTORE_PROOF.md`.

6. Concurrencia final validada.
   - Evidencia: doble pago, cierre de caja y numeracion fiscal probados con usuarios concurrentes o script aprobado.
   - Archivo sugerido: `qa/FINAL_CONCURRENCY_PROOF.md`.

7. Firewall y permisos del sistema operativo revisados.
   - Evidencia: puertos necesarios abiertos solo en LAN, carpetas de backups protegidas y usuario de servicio documentado.

8. `APP_URL`, CORS/Sanctum y variables production verificadas para LAN.
   - Evidencia: clientes navegan por IP/hostname final sin errores de sesion, CSRF ni assets.

9. Paquete offline final limpio y manifest actualizado si se entrega instalador.
   - Evidencia: checksum del paquete, versiones de Docker/images/dependencias y guia de instalacion final.

10. Composer audit/validate en entorno con Composer o contenedor backend.
    - Evidencia: `composer validate` y `composer audit --no-interaction` ejecutados en host/contenedor apto.

## Validaciones que no aplican

- Expediente clinico.
- Citas.
- HIS/EMR.
- Triage.
- Admisiones.
- Hospitalizacion.
- Laboratorio clinico.
- Farmacia clinica.
- Recetas clinicas.
- Portal de paciente.

## Regla de estado

Mientras estos puntos no tengan evidencia real, el sistema no debe declararse `PRODUCTION_READY`. Puede quedar como `READY_FOR_REAL_LAN_INSTALLATION_TEST` si los gates tecnicos pasan y el paquete esta listo para instalacion real.
