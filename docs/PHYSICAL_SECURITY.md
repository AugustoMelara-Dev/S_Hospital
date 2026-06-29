# Seguridad Fisica - S_Hospital (subagente 20)

## Proposito

Proteger el sistema aunque este offline. La seguridad fisica es la primera linea de defensa: si el atacante tiene acceso fisico al servidor, ninguna medida de software lo salva.

## Acceso fisico al servidor

- El servidor (PC con backend + MySQL/MariaDB + backups) debe estar en un cuarto con puerta con llave, preferiblemente con cerradura independiente del area de caja.
- Solo el responsable tecnico y su suplente designado deben tener llave.
- Llevar un registro fisico de ingresos al cuarto del servidor (fecha, hora, motivo, nombre).
- Si el servidor es un rack, el rack debe estar cerrado con llave y ventilado.

## Bloqueo de sesion

- Sesion del sistema se bloquea automaticamente por inactividad (configurable en Ajustes, default 10 minutos).
- Sesion del sistema operativo se bloquea automaticamente por inactividad (5 minutos recomendado para administradores, 1 minuto para servidores visibles en pasillo).
- Cualquier cajero que se retire de su puesto debe presionar `Win+L` o `Ctrl+Alt+Supr` antes de salir.

## Usuarios compartidos

- Prohibido usar cuentas compartidas como `cajero1`, `recepcion` o `admin` para varias personas.
- Cada persona (incluyendo cajeros rotativos) debe tener usuario individual con login personal.
- La cuenta `admin` inicial se desactiva o renombra despues de crear la cuenta del responsable tecnico real.
- Si un cajero se va del hospital, desactivar (no borrar) su cuenta y guardar en auditoria.

## Contrasena del administrador

- Minimo 10 caracteres con letras (mayusculas y minusculas), numeros y un simbolo.
- No usar la misma contrasena que el `HOSPITAL_INITIAL_ADMIN_PASSWORD` temporal de instalacion.
- Cambiar contrasena cada 90 dias o inmediatamente si hay sospecha de compromiso.
- Guardar copia de la contrasena del admin en sobre cerrado con el director del hospital o responsable autorizado, NO en la base de datos ni en archivos de texto plano.

## Exposicion de la base de datos

- MySQL/MariaDB debe escuchar solo en `127.0.0.1` o IP LAN del backend, NUNCA en `0.0.0.0`.
- El puerto 3306 NO debe estar abierto en el firewall del servidor.
- El archivo de base de datos (`/var/lib/mysql` o volumen Docker `mysql_prod_data`) NO debe estar en una carpeta accesible por red (sin compartir en red, sin SMB/NFS).
- El acceso a la base de datos es solo para el backend Laravel local; los cajeros y operadores no tocan la base directamente.

## USBs y dispositivos extraibles

- El servidor del hospital NO debe tener USBs de uso libre.
- Si soporte necesita conectar USB, documentar fecha, motivo, dispositivo y operador.
- Los USBs de respaldo (copia de `.sql.enc`) se guardan bajo llave en el cuarto del servidor o en caja fuerte del hospital.
- Los USBs de respaldo se rotan: uno se queda en el hospital, otro se lleva fuera (casa del director o caja de seguridad bancaria).

## Impresiones abandonadas

- Configurar la impresora para que NO apile trabajos en la bandeja de salida visibles a publico.
- El cajero debe recoger su impresion inmediatamente.
- Si una impresion contiene datos sensibles (recibo con nombre de paciente, monto, RTN), no debe quedar visible a otros pacientes.
- Impresiones fallidas o canceladas se destruyen (trituradora o corte manual) antes de descartar.

## PCs publicas o de uso multiple

- No instalar el sistema en PCs que se prestan a pacientes o publico general.
- Si una PC de caja queda en area visible, bloquear pantalla automaticamente a 1 minuto de inactividad.
- No dejar la ventana del sistema abierta cuando el cajero no esta en su puesto.

## Robo o dano de equipo

- Hacer backup a USB externo al menos 1 vez por semana.
- Mantener copia del paquete `offline-release/` actualizado en USB o disco externo.
- Si el servidor es robado o danado, los respaldos USB deben permitir restaurar en una PC nueva con el mismo `setup.bat` y la ultima version de `offline-release/`.
- Contrato de seguro o acuerdo documentado con el hospital para reposicion de hardware.

## Manual de seguridad fisica para el operador

| Item | Responsable | Frecuencia |
|------|-------------|-----------|
| Confirmar puerta del cuarto cerrada con llave | Responsable tecnico | Diario |
| Revisar registro fisico de ingresos al cuarto | Responsable tecnico | Semanal |
| Verificar que UPS esta cargado y operativo | Responsable tecnico | Semanal |
| Rotar USB de respaldo a caja fuerte externa | Director o designado | Mensual |
| Verificar contrasena del admin no esta en notas visibles | Responsable tecnico | Mensual |
| Confirmar que no hay USBs desconocidos conectados al servidor | Responsable tecnico | Diario |
| Verificar bloqueo de pantalla automatico activo | Soporte tecnico | Trimestral |

## Criterio de listo

Un usuario comun NO puede:
- Copiar la base de datos a USB.
- Borrar archivos de la carpeta de aplicacion o base.
- Abrir el puerto 3306 a la red.
- Cambiar la contrasena del admin sin dejar rastro.
- Conectar USBs sin autorizacion.

Si cualquiera de estos es posible, hay brecha critica de seguridad fisica que debe cerrarse antes de operar con datos reales.
