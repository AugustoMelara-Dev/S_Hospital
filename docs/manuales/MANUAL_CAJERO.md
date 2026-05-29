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

- No imprime: revise papel, impresora predeterminada y conexion. Avise si persiste.
- Servicio no aparece: revise categoria **Todos** y busqueda; si sigue sin aparecer, avise a administracion.
- El total parece incorrecto: no cobre; revise carrito y reglas antes de emitir.
- Cobro equivocado: avise al supervisor. No intente borrar facturas.
- Sistema lento o no abre: avise al responsable. No apague el servidor sin autorizacion.
