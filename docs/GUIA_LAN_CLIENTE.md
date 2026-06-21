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

1. Si la segunda PC tiene una copia del proyecto, ejecutar desde esa segunda PC:
   `powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://IP_DEL_SERVIDOR -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md`.
2. Si la segunda PC no tiene el proyecto ni paquetes instalados, copiar solo `scripts\validate_lan_client_standalone.ps1` al Escritorio de esa PC y ejecutar:
   `powershell.exe -ExecutionPolicy Bypass -File .\validate_lan_client_standalone.ps1 -BaseUrl http://IP_DEL_SERVIDOR -EvidencePath "$env:USERPROFILE\Desktop\LAN_CLIENT_VALIDATION_PROOF.md"`.
3. Confirmar en la salida del comando:
   - `/up`: OK.
   - `/login`: OK.
   - `/verify-email`: OK.
   - `/api/system/echo-config`: OK.
   - `/assets/*.js`: OK.
   - `WebSocket TCP`: OK.
4. Abrir `http://IP_DEL_SERVIDOR`.
5. Iniciar sesion con usuario autorizado.
6. Abrir Inicio, Nueva factura, Caja, Catalogo, Historial, Reportes, Respaldos, Configuracion, Usuarios y Ayuda segun permisos.
7. Crear factura de prueba en entorno autorizado.
8. Registrar pago en caja abierta.
9. Abrir recibo institucional.
10. Confirmar que no aparecen modulos clinicos fuera de alcance.

## Evidencia

Registrar resultado en `qa/LAN_CLIENT_VALIDATION_PROOF.md` con fecha, responsable, equipo cliente, URL LAN, navegador, usuario usado y capturas o referencias locales. El archivo debe incluir evidencia completa de `/api/system/echo-config` y `WebSocket TCP`; si falta esa evidencia, el preflight final no permite declarar `PRODUCTION_READY`.

## Revalidacion cuando cambia la IP del servidor

Si el servidor cambio de IP, la evidencia anterior queda historica y debe repetirse contra la URL final. Para la validacion actual del servidor final use:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://IP_FINAL_DEL_SERVIDOR:8081 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md -Force
```

Para la instalacion actual de esta PC, la IP detectada es `http://192.168.1.2:8081`.

Use `-Force` solo cuando el responsable tecnico autorice reemplazar la evidencia anterior. El archivo actualizado debe mencionar la BaseUrl final exacta; si todavia menciona solo una IP vieja, el preflight lo bloquea aunque los checks antiguos hayan pasado.

## Estado de release

Sin esta evidencia de segunda PC LAN, el sistema no puede declararse PRODUCTION_READY.
