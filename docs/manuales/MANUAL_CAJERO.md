# Manual Del Cajero

Este manual resume el trabajo diario del personal de caja.

## Abrir El Sistema

1. Use el acceso directo **Abrir Sistema de Caja Hospitalaria**.
2. Espere a que abra el navegador.
3. Si no abre, avise al responsable del sistema antes de reiniciar la computadora.

## Iniciar Sesion

1. Escriba su usuario.
2. Escriba su contrasena.
3. Presione **Iniciar sesion** o la tecla Enter.

No comparta su usuario. Toda factura, cobro o anulacion queda registrada con la cuenta que se use.

## Abrir Caja

1. Entre a **Caja**.
2. Presione **Abrir caja**.
3. Escriba el efectivo inicial.
4. Confirme.

No se debe facturar ni cobrar sin caja abierta.

## Crear Factura

1. Entre a **Nueva factura**.
2. Escriba el nombre del paciente.
3. Busque el servicio por nombre, categoria o codigo si esta habilitado.
4. Agregue los servicios al carrito.
5. Revise subtotal, impuesto y total.
6. Presione **Emitir y cobrar**.

Si se equivoca antes de emitir, quite el servicio del carrito o limpie la factura.

## Cobrar

1. Seleccione el metodo de pago.
2. Escriba el monto recibido.
3. Confirme el cobro.

Si el monto recibido es menor al total, el sistema no lo marcara como pagado completo. Si la administracion permite abonos parciales, el sistema mostrara el saldo pendiente.

## Imprimir Recibo

1. Despues de cobrar, abra la vista de recibo.
2. Revise paciente, numero, fecha, total, pagado y saldo.
3. Presione **Imprimir**.

El recibo institucional no debe llevar codigos internos ni QR.

## Reimprimir

1. Entre a **Historial**.
2. Busque por paciente, fecha o numero.
3. Use **Reimprimir** si tiene permiso.
4. Escriba el motivo si el sistema lo solicita.

## Cerrar Caja

1. Entre a **Caja**.
2. Presione **Cerrar caja**.
3. Cuente el efectivo real.
4. Escriba el monto contado.
5. Revise la diferencia.
6. Confirme.

Si hay diferencia, avise al supervisor.

## Si Algo Falla

- Si no imprime: revise impresora, papel y conexion.
- Si no abre el sistema: avise al responsable tecnico.
- Si aparece un error en pantalla: abra **Ayuda**, presione **Preparar resumen**
  y entregue ese texto al supervisor o responsable de soporte.
- Si el total no coincide: no cobre; revise servicios y carrito.
- Si cobro mal: avise al supervisor. No borre facturas.

No comparta contrasenas ni datos de pacientes por mensajes no autorizados.
No repita una factura o cobro para "probar" si no sabe si quedo registrado.

## Flujo de Eritropoyetina L.25 (receta de dialisis)

La eritropoyetina es un medicamento regulado. Si el paciente
presenta una receta de dialisis vigente, el sistema la cobra
en L. 0.00 (gratis) y deja la trazabilidad de quien autorizo la
exoneracion.

La factura solo requiere el nombre del paciente. Este sistema no maneja
expediente clinico completo ni exige paciente pre-registrado para facturar.
La marca de receta de dialisis se maneja en la factura que se esta emitiendo,
como bandera de autorizacion (`dialysis_prescription`, tambien documentada en
algunos formularios como `patient_has_dialysis_prescription`).

### Que hace el sistema automaticamente

1. Usted escribe el nombre del paciente en la factura.
2. Agrega el servicio de eritropoyetina al carrito.
3. Si el paciente presenta receta de dialisis vigente y su rol tiene permiso,
   marque la receta en la factura antes de emitir.
4. El backend valida el permiso `patients.mark_dialysis_prescription`.
5. Si la marca fue autorizada, el sistema pone el precio de la eritropoyetina en
   L. 0.00.
6. En el detalle de la linea aparece el mensaje
   **"Servicio exonerado por receta de dialisis"** para que
   quede claro al cajero, al supervisor y al auditor por que
   la linea esta en cero.
7. La factura puede quedar `paid` aunque el total sea L. 0.00.
   El sistema no crea un pago artificial de L. 0.00. La trazabilidad queda en
   caja, cajero, factura y auditoria con la accion
   `invoice.zero_amount_registered`.

### Permiso requerido

La marca `dialysis_prescription` de la factura solo la pueden usar los roles o
usuarios que tengan el permiso:

- `patients.mark_dialysis_prescription`

Normalmente este permiso pertenece a administracion o supervision. Si el
hospital decide que un cajero autorizado puede marcar la receta en caja, debe
asignarle ese permiso de forma explicita. Sin ese permiso, el sistema rechaza
la factura con error de validacion 422:
**"No tiene permiso para marcar pacientes con receta de dialisis."**

### Si usted cree que un paciente deberia estar exonerado

Si un paciente le presenta una receta de dialisis pero su
usuario **no** tiene permiso para marcar la receta en la factura, usted **no**
puede auto-aprobar la exoneracion. Lo que debe hacer:

1. **No** emita la factura como exonerada. Emitiria con el
   precio normal de la eritropoyetina.
2. Llame al **supervisor** o al **administrador** autorizado.
3. Pidale que revise la receta y emita la factura o asigne el permiso segun la
   politica del hospital.
4. Cuando la persona autorizada marque la receta en la factura, la linea de
   eritropoyetina saldra en L. 0.00.

Si el supervisor no esta disponible y el paciente tiene
urgencia, emita la factura con el precio regular de la
eritropoyetina. La exoneracion retroactiva no es parte de
este flujo y queda fuera del alcance de la caja.

### Que NO debe hacer

- No intente crear o modificar registros administrativos del paciente usted mismo.
- No marque la exoneracion solo en papel, en una nota, o por mensaje al
  supervisor. La autorizacion debe quedar marcada en la factura del sistema.
- No divida la linea de eritropoyetina para "ajustar" el
  precio. La exoneracion es total (L. 0.00), no parcial.
- No agregue el servicio a nombre de otro paciente para
  "aprovechar" la exoneracion de un paciente que si la
  tiene. Eso es un incidente de seguridad, no un atajo.
