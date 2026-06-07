# 06 Barcode QR Workflow

## Objetivo

Permitir que caja agregue servicios al carrito por scanner USB, codigo escrito o QR/barcode opcional, sin confiar en datos manipulables del frontend.

## Datos requeridos

Agregar a servicios si no existe:

- `scan_code`.
- `barcode` o alias compatible si el dominio ya usa ese nombre.
- `qr_code` opcional si se decide diferenciarlo.

El codigo debe ser unico para servicios activos cuando exista. Si hay servicios inactivos con codigo, no deben facturarse.

## Flujo scanner USB

1. Cajero enfoca campo de scanner.
2. Scanner escribe codigo como teclado.
3. Enter dispara busqueda.
4. Backend busca servicio activo por `scan_code`, `barcode`, `qr_code` o codigo equivalente.
5. Si encuentra, agrega al carrito con nombre/precio desde backend.
6. Si no encuentra, muestra error claro y conserva el foco.

## Flujo manual

El usuario puede escribir codigo y presionar Enter. El comportamiento debe ser identico al scanner.

## QR/camara opcional

Puede planificarse con `@zxing/browser`, pero debe quedar detras de boton y no ser dependencia critica del flujo. Scanner USB debe funcionar primero.

## Seguridad

- No confiar en precio enviado por frontend.
- No confiar en nombre enviado por frontend.
- No facturar servicios inactivos.
- Auditar codigo no encontrado si se vuelve relevante.
- Validar permisos para editar codigos en catalogo.

## Errores claros

- "No se encontro servicio activo para este identificador."
- "El servicio esta inactivo y no puede facturarse."
- "Codigo duplicado: revise el catalogo."

## Pruebas esperadas

- Buscar por codigo existente agrega servicio.
- Codigo inexistente muestra error.
- Servicio inactivo no se agrega.
- Precio final viene del backend.
- Eritropoyetina respeta regla especial.
