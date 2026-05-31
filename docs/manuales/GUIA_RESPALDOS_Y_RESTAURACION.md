# Guia De Respaldos Y Restauracion

Los respaldos protegen la informacion de caja, facturas, pagos y configuracion.

## Reglas Basicas

- Revise el ultimo respaldo todos los dias.
- Cree respaldo antes de actualizaciones.
- Mantenga una copia fuera de la computadora servidor.
- No guarde la unica copia dentro del mismo disco.
- No restaure sin autorizacion administrativa.

## Crear Respaldo Manual

1. Entre a **Respaldos**.
2. Revise el estado general.
3. Presione **Crear respaldo ahora**.
4. Espere estado **Completado**.
5. Copie el archivo a un medio seguro si corresponde.

## Respaldos Automaticos

El sistema puede programar respaldos:

- Durante operacion cada 15 minutos.
- Al cerrar caja.
- Una vez al dia.

Si un respaldo queda en pendiente mucho tiempo, avise al responsable tecnico.

El responsable tecnico puede validar que el worker procesa respaldos sin dejar
la contrasena escrita en el historial de PowerShell:

```powershell
$env:HOSPITAL_SMOKE_BASE_URL = "http://IP-DEL-SERVIDOR:8000"
$env:HOSPITAL_SMOKE_LOGIN = "usuario.soporte"
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_backup_worker_smoke.ps1
```

El script pedira la contrasena en pantalla segura si no se define
`HOSPITAL_SMOKE_PASSWORD`. Use una cuenta temporal autorizada y elimine las
variables de entorno de la sesion cuando termine.

## Restauracion

Restaurar cambia la informacion disponible en el sistema. Debe hacerse solo con autorizacion.

Antes de restaurar:

1. Detenga la facturacion.
2. Cree una copia del estado actual si es posible.
3. Confirme cual respaldo se usara.
4. Pruebe la restauracion en ambiente seguro cuando sea posible.
5. Documente fecha, motivo y responsable.

## Senales De Alerta

Avise si ve:

- Estado **Error**.
- Muchos respaldos pendientes.
- Archivo con tamano cero.
- Falta de respaldo reciente.
- Mensajes de permisos o disco lleno.
