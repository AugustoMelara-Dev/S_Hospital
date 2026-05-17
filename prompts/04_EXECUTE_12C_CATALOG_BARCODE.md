# 04 Execute 12C Catalog Barcode

Implementa solo Fase 12C si 12B esta cerrado.

## Alcance

- Catalogo profesional de categorias y servicios.
- Precio.
- Activo/inactivo.
- `scan_code`, `barcode` o `qr_code` si no existe.
- Regla especial Eritropoyetina.
- Busqueda por codigo desde POS.

## Reglas

- Scanner USB primero; camara/QR es opcional.
- Si encuentra servicio activo, agregarlo al carrito.
- Si no encuentra, mostrar error claro.
- Backend decide precio.
- Servicios inactivos no se facturan.

## Pruebas

- Codigo existente agrega servicio.
- Codigo inexistente muestra error.
- Inactivo no se agrega.
- Precio se toma de backend.
- Eritropoyetina respeta receta de dialisis.
