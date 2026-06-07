# 06 Service Scan Workflow

## Objetivo

Permitir que caja agregue servicios al carrito por identificador de servicio, sin confiar en datos manipulables del frontend y sin exponer codigos internos en el flujo normal de cobro.

## Datos requeridos

Los nombres de campos tecnicos se conservan solo como contrato interno entre backend, catalogo y migraciones:

- `scan_code`.
- `barcode`.
- `qr_code`.

Cada identificador debe ser unico para servicios activos cuando exista. Si un servicio esta inactivo, no debe facturarse aunque conserve un identificador historico.

## Flujo de escaneo de servicios

1. Cajero enfoca el campo "Identificador de servicio".
2. El lector o el teclado escribe el identificador.
3. Enter dispara busqueda.
4. Backend busca servicio activo por los campos tecnicos permitidos.
5. Si encuentra, agrega al carrito con nombre/precio desde backend.
6. Si no encuentra, muestra error claro y conserva el foco.

## Flujo manual

El usuario puede escribir el identificador y presionar Enter. El comportamiento debe ser identico al lector.

## Camara opcional

Puede planificarse lectura por camara en una fase futura, pero debe quedar detras de una accion explicita y no ser dependencia critica del flujo. El lector por teclado debe funcionar primero.

## Seguridad

- No confiar en precio enviado por frontend.
- No confiar en nombre enviado por frontend.
- No facturar servicios inactivos.
- Auditar identificador no encontrado si se vuelve relevante.
- Validar permisos para editar identificadores en catalogo.
- No mostrar identificadores crudos en tarjetas de servicios, recibos ni superficies normales de caja.

## Errores claros

- "No se encontro servicio activo para este identificador."
- "El servicio esta inactivo y no puede facturarse."
- "Identificador duplicado: revise el catalogo."

## Pruebas esperadas

- Buscar por identificador existente agrega servicio.
- Identificador inexistente muestra error.
- Servicio inactivo no se agrega.
- Precio final viene del backend.
- La UI de caja no muestra `scan_code`, `barcode` ni `qr_code` como texto visible.
- Eritropoyetina respeta regla especial.
