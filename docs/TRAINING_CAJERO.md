# Guia rapida para cajero

## Inicio de turno

1. Entrar con usuario propio; no compartir credenciales.
2. Abrir **Caja** y confirmar que no exista una caja abierta anterior.
3. Registrar monto inicial real.
4. Verificar que el estado de caja diga **Caja abierta**.

## Facturar y cobrar

1. Ir a **Nueva factura**.
2. Escribir el nombre del paciente.
3. Buscar servicio por nombre, categoria o codigo.
4. Revisar carrito y total antes de emitir.
5. Usar **Emitir y cobrar** como flujo normal.
6. Registrar metodo y monto recibido.
7. Abrir preview de recibo y mandar a imprimir.

## Reimpresion

1. Ir a **Historial**.
2. Buscar factura por paciente, fecha o numero.
3. Abrir detalle y usar reimpresion.
4. No crear una factura nueva para resolver una reimpresion.
5. Escribir motivo si el sistema lo solicita; la reimpresion queda registrada.

## Cierre de caja

1. Ir a **Caja**.
2. Contar efectivo fisico.
3. Registrar monto contado.
4. Si hay diferencia, escribir nota clara.
5. Confirmar cierre solo cuando ya se revisaron pagos y recibos.

## Errores comunes

- Si aparece sesion expirada, volver a iniciar sesion.
- Si no hay caja abierta, no se puede facturar.
- Si un backup queda pendiente, avisar al admin; el cajero no debe tocar scripts del servidor.
- Si se cobro mal, avisar al supervisor; el cajero no debe borrar facturas ni intentar compensar con otra factura.
- Si hay diferencia de caja, cerrar con una nota clara y avisar al supervisor.

## Practica sin tocar datos reales

1. Practicar solo en entorno local/demo o base descartable autorizada.
2. No usar nombres de pacientes reales en ejercicios.
3. No emitir facturas de entrenamiento en la base real de produccion.
4. Si el supervisor autoriza un simulacro en el servidor final, debe existir respaldo previo y los datos deben quedar marcados como prueba.
