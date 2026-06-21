# Guia LAN Cliente

## Objetivo

Validar que una computadora cliente pueda operar S_Hospital desde la red local sin internet.

## Preparacion

1. Confirmar que el servidor tiene `APP_URL` con IP o nombre LAN.
2. Confirmar que el firewall permite el puerto HTTP/HTTPS configurado.
3. Confirmar que el firewall permite el puerto de sincronizacion en tiempo
   real Soketi/WebSocket, por defecto `6001` o el valor de `SOKETI_PORT`,
   solo en red privada/local.
4. Confirmar que el cliente esta en la misma red local.
5. Usar navegador actualizado instalado localmente.

## Validacion minima

1. Ejecutar desde la segunda PC:
   `powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://IP_DEL_SERVIDOR -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md`.
2. Confirmar en la salida del comando:
   - `/up`: OK.
   - `/login`: OK.
   - `/verify-email`: OK.
   - `/api/system/echo-config`: OK.
   - `/assets/*.js`: OK.
   - `WebSocket TCP`: OK.
3. Abrir `http://IP_DEL_SERVIDOR`.
4. Iniciar sesion con usuario autorizado.
5. Abrir Inicio, Nueva factura, Caja, Catalogo, Historial, Reportes, Respaldos, Configuracion, Usuarios y Ayuda segun permisos.
6. Crear factura de prueba en entorno autorizado.
7. Registrar pago en caja abierta.
8. Abrir recibo institucional.
9. Confirmar que no aparecen modulos clinicos fuera de alcance.

## Evidencia

Registrar resultado en `qa/LAN_CLIENT_VALIDATION_PROOF.md` con fecha, responsable, equipo cliente, URL LAN, navegador, usuario usado y capturas o referencias locales. El archivo debe incluir evidencia completa de `/api/system/echo-config` y `WebSocket TCP`; si falta esa evidencia, el preflight final no permite declarar `PRODUCTION_READY`.

## Revalidacion cuando cambia la IP del servidor

Si el servidor cambio de IP, la evidencia anterior queda historica y debe repetirse contra la URL final. Para la validacion actual del servidor final use:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://192.168.1.10:8081 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md -Force
```

Use `-Force` solo cuando el responsable tecnico autorice reemplazar la evidencia anterior. El archivo actualizado debe mencionar `http://192.168.1.10:8081`; si todavia menciona solo una IP vieja, el preflight lo bloquea aunque los checks antiguos hayan pasado.

## Estado de release

Sin esta evidencia de segunda PC LAN, el sistema no puede declararse PRODUCTION_READY.
