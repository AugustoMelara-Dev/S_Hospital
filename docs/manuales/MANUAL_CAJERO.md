# Manual del cajero

Sistema institucional de caja y facturacion del Hospital San Isidro.

## Objetivo del turno

El cajero debe abrir caja, registrar paciente, agregar servicios, cobrar, imprimir recibo institucional, reimprimir cuando corresponda y cerrar caja con el efectivo contado.

## 1. Abrir el sistema

1. Use el acceso directo **Hospital San Isidro - Caja** o el acceso que indique administracion.
2. Espere a que abra el navegador.
3. Ingrese con su usuario personal.
4. No comparta usuario ni contrasena. Todo cobro queda asociado a la cuenta usada.

Si el sistema no abre, no borre archivos ni reinicie servicios por su cuenta. Avise al responsable.

## 2. Abrir caja

1. Entre a **Caja**.
2. Presione **Abrir caja**.
3. Escriba el efectivo inicial disponible para cambio.
4. Confirme.

No emita facturas sin caja abierta.

## 3. Crear una factura

1. Entre a **Nueva factura**.
2. Escriba el nombre del paciente. Solo el nombre es obligatorio.
3. Busque servicios por nombre, categoria o codigo si administracion habilito escaner.
4. Use **Todos** para ver servicios activos de todas las categorias.
5. Agregue los servicios al carrito.
6. Revise subtotal, ISV, total y reglas especiales antes de emitir.
7. Presione **Emitir y cobrar**.

Si se equivoca antes de emitir, quite el servicio o limpie la factura. Si ya emitio, no borre nada: avise al supervisor.

## 4. Eritropoyetina

- Eritropoyetina tiene precio de L.25.00.
- Si el paciente trae receta de dialisis y el sistema muestra la opcion correspondiente, marque la receta antes de emitir.
- No aplique descuentos manuales fuera del flujo del sistema.

## 5. Cobrar

1. Seleccione metodo: efectivo, tarjeta, transferencia u otro.
2. Escriba el monto recibido.
3. Para tarjeta o transferencia, escriba la referencia visible del comprobante. No escriba datos sensibles de tarjeta.
4. Revise cambio o saldo pendiente.
5. Confirme el cobro.

Reglas importantes:

- Si el monto recibido es menor al total, el sistema no debe marcar la factura como pagada completa.
- Los abonos parciales solo se permiten si administracion los habilito.
- Tarjeta y transferencia no aumentan el efectivo esperado en caja.

## 6. Imprimir recibo

1. Revise la vista previa del recibo.
2. Confirme hospital, paciente, numero, fecha, servicios, total, pagado y saldo si aplica.
3. Presione **Imprimir**.
4. Seleccione la impresora institucional autorizada.

El recibo debe ser institucional en papel, sin QR, sin codigo de barras y sin codigos internos.

## 7. Reimprimir

1. Entre a **Historial**.
2. Busque por paciente, numero o fecha.
3. Abra la factura.
4. Use **Reimprimir** si tiene permiso.
5. Escriba el motivo si el sistema lo solicita.

La reimpresion usa los datos historicos de la factura original.

## 8. Cerrar caja

1. Entre a **Caja**.
2. Presione **Cerrar caja**.
3. Cuente solo el efectivo fisico en gaveta.
4. No incluya tarjeta ni transferencia.
5. Escriba el efectivo contado.
6. Revise diferencia.
7. Si hay diferencia, escriba nota clara y avise al supervisor.

No cierre caja si quedan facturas pendientes o parciales sin resolver.

## 9. Problemas frecuentes

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
