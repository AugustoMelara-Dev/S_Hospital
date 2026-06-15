# Guia LAN Cliente

## Objetivo

Validar que una computadora cliente pueda operar S_Hospital desde la red local sin internet.

## Preparacion

1. Confirmar que el servidor tiene `APP_URL` con IP o nombre LAN.
2. Confirmar que el firewall permite el puerto HTTP/HTTPS configurado.
3. Confirmar que el cliente esta en la misma red local.
4. Usar navegador actualizado instalado localmente.

## Validacion minima

1. Abrir `http://IP_DEL_SERVIDOR`.
2. Confirmar que `/up` responde.
3. Iniciar sesion con usuario autorizado.
4. Abrir Inicio, Nueva factura, Caja, Catalogo, Historial, Reportes, Respaldos, Configuracion, Usuarios y Ayuda segun permisos.
5. Crear factura de prueba en entorno autorizado.
6. Registrar pago en caja abierta.
7. Abrir recibo institucional.
8. Confirmar que no aparecen modulos clinicos fuera de alcance.

## Evidencia

Registrar resultado en `qa/LAN_CLIENT_VALIDATION_PROOF.md` con fecha, responsable, equipo cliente, URL LAN, navegador, usuario usado y capturas o referencias locales.

## Estado de release

Sin esta evidencia de segunda PC LAN, el sistema no puede declararse PRODUCTION_READY.
