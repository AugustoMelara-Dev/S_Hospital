# Referencia: identificadores de servicio para caja

## Objetivo

Permitir que caja agregue servicios al carrito mediante un identificador administrado por catalogo, sin exponer codigos internos al cajero y sin confiar en datos enviados por el frontend.

## Flujo operativo

- El operador busca por nombre, categoria o identificador de servicio.
- Si el identificador corresponde a un servicio activo, el backend devuelve el servicio autorizado.
- Si no hay coincidencia, la UI muestra un mensaje claro y mantiene el foco en la busqueda.
- Servicios inactivos no se agregan al carrito.
- El backend decide precio, impuesto, regla especial y vigencia.

## Contrato tecnico interno

Los campos `scan_code`, `barcode` y `qr_code` pueden existir para compatibilidad tecnica, migraciones o soporte de catalogo. No deben aparecer como texto visible en el flujo normal de caja ni en el recibo institucional.

## Criterios de validacion

- La UI usa "identificador de servicio" o "escaneo de servicios".
- Las tarjetas de Nueva factura no muestran valores crudos de identificadores.
- El recibo no imprime QR, codigo de barras, identificadores internos ni datos tecnicos.
- Los reportes y auditoria muestran etiquetas humanas.
