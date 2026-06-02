# 03 POS Billing UX Spec

## Objetivo

La pantalla de Nueva factura debe sentirse como POS/caja profesional: rapida, clara, operable con teclado, scanner y mouse. No debe parecer formulario administrativo ni lista interminable.

## Layout recomendado

- Columna izquierda: categorias y filtros.
- Centro: busqueda rapida, campo scanner y servicios filtrados.
- Derecha: carrito, resumen, paciente, pago y acciones.

## Flujo principal

1. Cajero abre Nueva factura.
2. Ingresa nombre del paciente.
3. Busca servicio por texto, categoria o scanner.
4. Selecciona servicio activo.
5. El servicio entra al carrito con snapshot de nombre y precio desde backend.
6. Ajusta cantidad si aplica.
7. Revisa subtotal, ISV/descuentos/reglas especiales y total.
8. Selecciona metodo de pago.
9. Confirma emision/cobro.
10. Imprime recibo institucional A5, carta, media carta, 80mm o 58mm segun configuracion.

## Busqueda rapida

- Buscar por nombre, categoria, codigo interno, scan_code, barcode o qr_code.
- Debe responder rapido y mantener foco de teclado.
- Debe mostrar estado "sin resultados" claro.
- Debe permitir limpiar filtros con una accion visible.

## Categorias

Las categorias deben estar visibles como tabs, chips o sidebar secundaria. El cajero debe poder filtrar sin recorrer los 122 servicios.

## Servicios

Representacion permitida:

- Tarjetas compactas con nombre, precio, categoria y estado.
- Tabla compacta con acciones rapidas.

Representacion bloqueada:

- Lista interminable sin categoria ni busqueda.
- Cards gigantes con demasiado texto.
- Servicios inactivos mezclados como si fueran facturables.

## Carrito lateral

Debe mostrar:

- Servicios seleccionados.
- Cantidad.
- Precio snapshot.
- Total por item.
- Accion quitar.
- Resumen de factura.
- Metodo de pago.
- Boton principal Cobrar/Emitir.
- Boton imprimir/reimprimir segun estado.

## Reglas criticas

- Backend decide precio y reglas fiscales.
- Frontend solo previsualiza.
- Eritropoyetina se cobra L.25, salvo receta de dialisis marcada.
- Toda factura pagada debe asociarse a caja, cajero, metodo y fecha.
- El recibo institucional debe estar disponible al completar el cobro.
