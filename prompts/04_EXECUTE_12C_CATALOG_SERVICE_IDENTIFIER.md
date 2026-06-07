# 04 Execute 12C Catalog Service Identifier

Implementa solo Fase 12C si 12B esta cerrado.

## Alcance

- Catalogo profesional de categorias y servicios.
- Precio.
- Activo/inactivo.
- Identificador de servicio para escaneo, respaldado por los campos internos necesarios.
- Regla especial Eritropoyetina.
- Busqueda por identificador desde POS.

## Reglas

- El flujo visible habla de escaneo de servicios e identificador de servicio.
- Los campos internos `scan_code`, `barcode` o `qr_code` no se muestran al cajero ni al recibo.
- Si encuentra servicio activo, agregarlo al carrito.
- Si no encuentra, mostrar error claro.
- Backend decide precio.
- Servicios inactivos no se facturan.

## Pruebas

- Identificador existente agrega servicio.
- Identificador inexistente muestra error.
- Inactivo no se agrega.
- Precio se toma de backend.
- Eritropoyetina respeta receta de dialisis.
