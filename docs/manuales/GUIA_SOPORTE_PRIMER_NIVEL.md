# Guia De Soporte De Primer Nivel

Esta guia es para la persona del hospital que recibe el primer aviso cuando el
sistema no abre, no imprime, queda una caja abierta, falla un respaldo o una
computadora cliente pierde conexion.

El objetivo es mantener la caja funcionando sin poner en riesgo los datos.

## Regla Principal

No borre datos, no borre volumenes Docker, no edite `.env`, no restaure backups
por cuenta propia y no use `migrate:fresh` en el servidor del hospital.

Si hay duda, detenga nuevas facturas desde clientes y recopile evidencia.

## Datos Que Debe Anotar

- Fecha y hora.
- Nombre de la persona que reporta.
- Computadora afectada: servidor o cliente.
- Pantalla donde ocurrio el problema.
- Mensaje visible en pantalla.
- Si habia caja abierta.
- Si habia una factura o pago en proceso.
- Si la red local funcionaba en otras computadoras.
- Si la impresora tenia papel, energia y conexion.

## Primeras Revisiones Seguras

1. Confirme que la computadora servidor esta encendida.
2. Confirme que el cliente usa la direccion LAN del servidor, no `localhost`.
3. Abra el sistema desde el acceso directo.
4. Si no abre, espere dos minutos y vuelva a intentar. El acceso directo
   ejecutara reparacion segura automaticamente si el servidor no responde.
5. No escriba usuario, contrasena ni token dentro de la direccion. Use solo
   `http://IP-DEL-SERVIDOR:8000`; los scripts rechazan direcciones como
   `http://usuario:contrasena@IP-DEL-SERVIDOR:8000` para proteger logs y
   accesos directos.
6. Si soporte necesita repetir la revision de forma manual, ejecute:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\repair_hospital_system.ps1 -BaseUrl http://127.0.0.1:8000
```

El archivo de salida esperado es:

```text
qa\LOCAL_REPAIR_DIAGNOSTIC.md
```

Ese archivo se puede enviar a soporte. No debe contener passwords, tokens ni
claves. Las rutas locales y valores con nombres sensibles se reemplazan por
marcadores como `%PROJECT_ROOT%`, `%USERPROFILE%`, `[ruta-local]` o
`[redacted]`.
Las salidas en consola de los scripts de soporte usan los mismos marcadores
cuando muestran carpetas generadas o errores de rutas. No envie capturas donde
aparezcan rutas reales, `.env`, passwords o tokens.

Si soporte pide un paquete mas completo, genere uno con:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\collect_support_packet.ps1 -RunRepairDiagnostic -SkipDockerStart
```

El script crea una carpeta en `qa\support-packets\`. Incluye diagnostico y
extractos de logs recortados. No copia `.env`, respaldos `.sql`, passwords,
tokens ni carpetas completas de datos.

Antes de entregar o actualizar el paquete offline, soporte tecnico puede validar
que esa proteccion sigue funcionando sin tocar datos reales:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_support_packet_safety.ps1
```

El validador crea un fixture temporal, genera un paquete de soporte y falla si
aparecen secretos, `.env` o rutas locales reales. No levanta Docker, no migra y
no consulta la base de datos del hospital.

Antes de enviar el reporte final de entrega, valide que el indice de evidencias
no tenga archivos faltantes, rutas locales ni una declaracion prematura de
produccion lista:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_ops_evidence_index.ps1
```

Ese cheque no levanta servicios ni toca la base de datos. Solo revisa el handoff
final y los archivos de evidencia dentro de `qa\`.

## Evidencia Dentro Del Sistema

Si puede iniciar sesion:

1. Abra **Ayuda**.
2. Busque **Evidencia local para soporte**.
3. Presione **Preparar resumen**.
4. Si el navegador lo permite, pegue el resumen en el mensaje de soporte. Si no,
   muestre esa pantalla o tome captura.
5. Presione **Ver evidencia** solo si soporte necesita ver los ultimos incidentes.
6. Abra **Respaldos** si tiene permiso y revise si dice **Todo bien**,
   **Requiere revision** o **Error**.

No copie datos de pacientes fuera de los canales autorizados.
No copie `.env`, passwords, tokens, rutas locales del servidor ni mensajes tecnicos crudos.

## Que Hacer Segun El Problema

### Servidor No Disponible

- Ejecute la reparacion segura.
- Revise si `/up`, `/api/health`, `/login` y `/verify-email` responden.
- Si el diagnostico marca error, envie `qa\LOCAL_REPAIR_DIAGNOSTIC.md`.

### Red Local Caida

- Pruebe desde la computadora servidor.
- Revise en el diagnostico la fila **Direccion APP_URL para LAN**.
- Si indica `localhost` o `127.0.0.1`, el servidor puede abrir localmente pero
  las computadoras cliente deben usar la IP o nombre LAN del servidor.
- Si la IP del servidor cambio por DHCP, cambio de router o cambio de tarjeta
  de red, soporte tecnico debe validar primero sin aplicar cambios:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\refresh_lan_ip.ps1 -WhatIf
```

- Si la IP detectada es la correcta, soporte tecnico puede ejecutar el refresco
  y luego validar desde una computadora cliente con `validate_lan_client.ps1`.
- No facture desde clientes hasta que vuelva la conexion.
- Anote que computadoras fallaron y cuales siguieron funcionando.

### Impresora No Responde

- No repita la factura ni el cobro.
- Revise papel, energia, cable y si Windows ve la impresora.
- Cuando vuelva a funcionar, reimprima desde Historial con motivo.

### Caja Quedo Abierta

- No abra otra caja para ocultar el problema.
- Revise pagos, facturas pendientes y efectivo contado.
- Cierre con conteo real y nota, o escale al administrador si falta permiso.

### Respaldo Fallido

- No restaure.
- Revise **Respaldos** y el estado operativo.
- Confirme si hay espacio en disco.
- Confirme si el worker de respaldos esta activo.
- Escale con el mensaje visible y el diagnostico.

### Sesion Vencida O Sin Permiso

- Pida al usuario iniciar sesion de nuevo.
- No use la cuenta de otra persona.
- Si falta permiso, el administrador debe revisar el rol.

## Paquete Minimo Para Escalar

Envie al responsable tecnico:

- `qa\LOCAL_REPAIR_DIAGNOSTIC.md` si existe.
- Carpeta generada por `scripts\collect_support_packet.ps1` si soporte la pidio.
- Resumen seguro preparado desde **Ayuda**.
- Captura de la pantalla de Ayuda con evidencia local segura si el resumen no se puede copiar.
- Captura de Respaldos con el estado operativo.
- Hora del incidente.
- Usuario y rol afectado.
- Pantalla o accion que se estaba usando.
- Confirmacion de si hubo factura, pago o caja abierta.

## Acciones Prohibidas En Soporte De Primer Nivel

- Borrar la base de datos.
- Borrar carpetas de `backend\storage`.
- Borrar volumenes de Docker.
- Cambiar passwords compartidos sin registrar responsable.
- Restaurar un backup sobre produccion sin autorizacion.
- Ejecutar seeders de prueba en produccion.
- Repetir facturas o pagos para "probar".

## Cierre Del Incidente

Antes de decir que quedo resuelto:

1. Abra el sistema.
2. Inicie sesion.
3. Revise caja.
4. Revise Historial si habia factura o pago en proceso.
5. Verifique que Respaldos no este en **Error**.
6. Anote que accion resolvio el problema.
