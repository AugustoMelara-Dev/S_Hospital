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
4. Si no abre, espere dos minutos y vuelva a intentar.
5. Si sigue fallando, ejecute la reparacion segura.

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\repair_hospital_system.ps1 -BaseUrl http://127.0.0.1:8000
```

El archivo de salida esperado es:

```text
qa\LOCAL_REPAIR_DIAGNOSTIC.md
```

Ese archivo se puede enviar a soporte. No debe contener passwords, tokens ni
claves.

## Evidencia Dentro Del Sistema

Si puede iniciar sesion:

1. Abra **Ayuda**.
2. Busque **Evidencia local para soporte**.
3. Presione **Ver evidencia**.
4. Copie el mensaje seguro o tome captura.
5. Abra **Respaldos** si tiene permiso y revise si dice **Todo bien**,
   **Requiere revision** o **Error**.

No copie datos de pacientes fuera de los canales autorizados.

## Que Hacer Segun El Problema

### Servidor No Disponible

- Ejecute la reparacion segura.
- Revise si `/up`, `/api/health`, `/login` y `/verify-email` responden.
- Si el diagnostico marca error, envie `qa\LOCAL_REPAIR_DIAGNOSTIC.md`.

### Red Local Caida

- Pruebe desde la computadora servidor.
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
- Captura de la pantalla de Ayuda con evidencia local segura.
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
