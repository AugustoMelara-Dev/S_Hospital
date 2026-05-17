# Referencia: impresión térmica 80mm / 58mm

## Objetivo
Generar recibos pequeños compatibles con impresoras térmicas POS.

## Requisitos
- Tamaño 80mm por defecto.
- Opción 58mm configurable.
- Vista previa antes de imprimir.
- Reimpresión desde historial.
- PDF/print CSS específico para recibo, no hoja carta.

## Contenido mínimo
- Nombre del hospital.
- RTN/CAI/rango si se configura.
- Número de factura.
- Fecha y hora.
- Cajero.
- Nombre del paciente.
- Servicios con precio snapshot.
- Subtotal, ISV, total.
- Mensaje final.

## CSS recomendado
Usar @media print y @page size con ancho fijo. Evitar tablas complejas si causan cortes. Probar en impresora real.
