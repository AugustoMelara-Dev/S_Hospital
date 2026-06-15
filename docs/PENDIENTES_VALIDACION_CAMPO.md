# Pendientes de Validacion en Campo

Estos pendientes no son modulos faltantes. Son evidencias fisicas necesarias antes de declarar PRODUCTION_READY.

## Pendientes obligatorios

- Servidor final instalado con configuracion production.
- Segunda PC conectada por LAN accediendo por IP/hostname local.
- Impresora fisica final con papel real y formato institucional validado.
- Backup worker o tarea programada corriendo en servidor real.
- Restore probado en base descartable usando backup real o representativo.
- Firewall y permisos del sistema operativo revisados.
- APP_URL, CORS/Sanctum y variables production verificadas para LAN.
- Paquete offline final limpio y manifest actualizado si se entrega instalador.

## Regla de estado

Mientras estos puntos no tengan evidencia real, el sistema no debe declararse PRODUCTION_READY. Puede quedar en DEMO_UAT_READY, TECHNICAL_DELIVERY_READY o READY_FOR_REAL_LAN_INSTALLATION_TEST segun gates tecnicos.
