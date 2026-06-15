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

Como cajero, usted NO puede marcar la receta usted mismo. Esa
es una decision medica y administrativa que vive en la ficha
del paciente.

### Que hace el sistema automaticamente

1. El paciente debe estar **pre-registrado** por un
   administrador o supervisor con el marcador
   `dialysis_prescription = true` en su ficha.
2. Cuando usted agrega el servicio de eritropoyetina al
   carrito de una factura de ese paciente, el sistema pone el
   precio de esa linea en L. 0.00 automaticamente.
3. En el detalle de la linea aparece el mensaje
   **"Servicio exonerado por receta de dialisis"** para que
   quede claro al cajero, al supervisor y al auditor por que
   la linea esta en cero.
4. La factura puede quedar `paid` aunque el total sea L. 0.00.
   El sistema crea un `payment` por L. 0.00 con metodo `other`
   y referencia humana para conservar la trazabilidad. Ese
   pago no aumenta el efectivo esperado de la caja.

### Permiso requerido

La marca `dialysis_prescription` en la ficha del paciente solo
la pueden poner los roles:

- `admin` (administrador del hospital)
- `supervisor`

El rol `cajero` **no** tiene el permiso
`patients.mark_dialysis_prescription`. El sistema rechaza
cualquier intento de cajero de enviar esa marca en la factura
con un error de validacion 422
("No tiene permiso para marcar pacientes con receta de
dialisis.").

### Si usted cree que un paciente deberia estar exonerado

Si un paciente le presenta una receta de dialisis pero su
ficha en el sistema **no** tiene la marca
`dialysis_prescription`, usted **no** puede corregir la ficha
ni auto-aprobar la exoneracion. Lo que debe hacer:

1. **No** emita la factura como exonerada. Emitiria con el
   precio normal de la eritropoyetina.
2. Llame al **supervisor** o al **administrador** del sistema.
3. Pidale que actualice la ficha del paciente y active la
   marca `dialysis_prescription`.
4. Cuando el supervisor confirme que ya marco la ficha,
   vuelva a crear la factura: la linea de eritropoyetina
   saldra en L. 0.00 automaticamente.

Si el supervisor no esta disponible y el paciente tiene
urgencia, emita la factura con el precio regular de la
eritropoyetina. La exoneracion retroactiva no es parte de
este flujo y queda fuera del alcance de la caja.

### Que NO debe hacer

- No intente editar la ficha del paciente usted mismo.
- No marque la exoneracion en papel, en una nota, o por
  mensaje al supervisor. La unica fuente de verdad es la
  ficha del paciente en el sistema.
- No divida la linea de eritropoyetina para "ajustar" el
  precio. La exoneracion es total (L. 0.00), no parcial.
- No agregue el servicio a nombre de otro paciente para
  "aprovechar" la exoneracion de un paciente que si la
  tiene. Eso es un incidente de seguridad, no un atajo.
