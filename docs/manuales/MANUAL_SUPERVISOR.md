# Manual Del Supervisor

Este manual es para el responsable de turno que acompana al cajero, revisa
incidentes y autoriza acciones delicadas sin reemplazar al administrador del sistema.

## Inicio Del Turno

1. Confirme que el servidor y las computadoras cliente abren el sistema.
2. Verifique que cada cajero use su propia cuenta.
3. Confirme que la caja del turno se abra con el monto inicial correcto.
4. Revise que haya papel e impresora disponible antes de empezar a cobrar.
5. Revise en **Respaldos** si el estado operativo dice **Protegido**,
   **Pendiente** o **Error**.

Si aparece **Error**, no lo ignore. Revise el detalle avanzado o avise al
administrador antes de operar todo el turno.

## Durante El Turno

- Revise diferencias de caja apenas se detecten.
- No permita que dos personas usen la misma cuenta.
- No autorice reimpresiones sin motivo claro.
- No autorice anulaciones sin revisar factura, pago y motivo.
- Si el navegador se cierra, vuelva a abrir el sistema y revise Historial antes
  de repetir una factura o cobro.

## Anulaciones Y Reimpresiones

Antes de autorizar:

1. Busque la factura en **Historial**.
2. Revise paciente, numero, fecha, cajero, total y estado.
3. Confirme si tiene pagos registrados.
4. Escriba un motivo entendible.
5. Confirme que la accion queda auditada.

No borre facturas. Si una factura pagada requiere correccion y el sistema no
ofrece reverso autorizado, detenga el caso y avise a administracion.

## Advertencias Antes De Acciones Delicadas

- Antes de autorizar una anulacion, revise factura, pago, cajero, fecha y motivo.
- Antes de autorizar una reimpresion, confirme que la factura correcta esta en Historial.
- Antes de pedir repetir una factura o cobro, revise Historial y pagos registrados.
- Antes de cerrar caja con diferencia, exija conteo real y una nota entendible.
- Nunca borre facturas, no use la cuenta del cajero y no oculte diferencias de caja.

## Cierre De Caja

1. Pida al cajero revisar pagos por metodo.
2. Compare efectivo esperado contra efectivo contado.
3. Revise facturas pendientes o parciales antes de cerrar.
4. Si hay diferencia, registre el motivo y no lo oculte.
5. Verifique que el reporte del dia refleja el cierre.

## Fallos Reales Y Que Hacer

### Servidor No Disponible

- Detenga nuevas facturas desde clientes.
- Verifique si la computadora servidor esta encendida.
- Use la guia de reparacion segura o avise al administrador.
- No borre carpetas ni reinicie datos.

### Red Local Caida

- No use `localhost` en computadoras cliente.
- Si solo funciona el servidor, opere desde el servidor solo si administracion lo
  autoriza.
- Anote hora de inicio y fin del incidente.

### Impresora No Responde

- No repita la factura ni el cobro.
- Revise papel, energia, cable o impresora compartida.
- Reimprima desde Historial con motivo cuando vuelva a funcionar.

### Caja Quedo Abierta

- No abra otra caja para tapar el problema.
- Revise el usuario responsable y los pagos registrados.
- Cierre con conteo real y nota si corresponde.

### Respaldo Fallido

- No restaure por cuenta propia.
- Revise **Respaldos** y detalle avanzado si tiene permiso.
- Avise al administrador para revisar espacio, estado de respaldos y ultimo error visible.

### Sesion Vencida O Sin Permiso

- Pida al usuario iniciar sesion de nuevo.
- No use la cuenta de otra persona.
- Si falta permiso, solicite revision de rol al administrador.

## Capacitacion Sin Tocar Produccion

Si no existe un modo practica aislado, capacite en una instalacion separada o en
una base descartable preparada por administracion. No use la base real para
ensayar anulaciones, restauraciones, cobros ficticios o cierres de caja.

Use `docs\manuales\GUIA_CAPACITACION_SEGURA.md` antes de entrenar personal. El
supervisor debe confirmar que el cajero practica como responder a servidor no
disponible, red caida, impresora sin respuesta, sesion vencida y error de
permisos sin repetir facturas ni cobros.

## Checklist Diario Del Supervisor

- [ ] Servidor abre el sistema.
- [ ] Cajeros ingresan con cuenta propia.
- [ ] Caja inicial revisada.
- [ ] Impresora y papel revisados.
- [ ] Estado operativo revisado.
- [ ] Reimpresiones con motivo.
- [ ] Anulaciones con motivo y permiso.
- [ ] Facturas pendientes revisadas antes del cierre.
- [ ] Diferencias de caja documentadas.
- [ ] Respaldo reciente verificado o reportado.
