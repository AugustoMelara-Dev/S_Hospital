# Guia de Backup y Restore

## Backup manual

El administrador puede crear respaldos desde el modulo Respaldos cuando el permiso esta habilitado. Los cajeros no deben administrar ni descargar respaldos.

## Backup programado

En instalacion final debe existir worker, tarea programada o mecanismo equivalente para backup diario local. La tarea debe ejecutarse en el servidor real y guardar archivos en ruta protegida.

## Restore documentado

El restore debe probarse primero en base descartable. No restaurar sobre produccion sin backup previo, ventana autorizada y responsable presente.

Procedimiento general:

1. Confirmar archivo de backup y checksum si existe.
2. Preparar base descartable o entorno de validacion.
3. Ejecutar script/procedimiento de restore documentado del proyecto.
4. Verificar login, catalogo, facturas, pagos, reportes y recibos.
5. Registrar resultado en acta o reporte de campo.

## Pendiente de campo

Si el restore no se ejecuto en el servidor final, queda como PENDIENTE DE VALIDACION EN CAMPO. No bloquea demo/UAT, pero bloquea PRODUCTION_READY.
