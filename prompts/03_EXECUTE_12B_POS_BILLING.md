# 03 Execute 12B POS Billing

Implementa solo Fase 12B si 12A esta cerrado.

## Alcance

- POS profesional de facturacion.
- Busqueda rapida de servicios.
- Seleccion por categoria.
- Servicios como tarjetas o tabla compacta.
- Carrito lateral.
- Resumen de factura.
- Pago claro.
- Recibo termico.

## Bloqueos

- No lista interminable de 122 servicios.
- No confiar en precio enviado por frontend.
- No mezclar catalogo administrativo profundo salvo lo necesario para consumir categorias.

## Pruebas

- Crear factura.
- Agregar servicio por busqueda.
- Agregar servicio por categoria.
- Cobrar.
- Ver/imprimir recibo.
