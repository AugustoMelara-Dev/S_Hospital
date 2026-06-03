# 01 Final Product Requirements

## Objetivo

Convertir el sistema funcional actual en un producto hospitalario local, profesional y vendible. El sistema debe seguir funcionando offline en LAN y no debe depender de SaaS obligatorios para login, facturacion, reportes o impresion.

## Requerimientos UX globales

- Prohibida una sola pagina interminable.
- App shell profesional con sidebar izquierdo, topbar y layout persistente.
- Cada modulo debe vivir en ruta interna separada.
- La navegacion debe ser visible, estable y pensada para uso diario de caja.
- Las pantallas deben tener estados de carga, vacio, error, exito y confirmacion.
- Acciones sensibles como anular, reimprimir, cerrar caja y restaurar backup requieren confirmacion clara.

## Modulos separados

- Nueva factura / POS: flujo rapido para crear factura, seleccionar servicios, cobrar e imprimir.
- Caja: apertura, movimientos, cierre, arqueo y caja activa.
- Catalogo: categorias, servicios, precios, activo/inactivo, scan_code y reglas especiales.
- Historial: facturas emitidas, pagadas, anuladas, reimpresiones y detalle.
- Reportes avanzados: dashboard gerencial, ventas, ingresos, categorias, cajeros, anulaciones, backups.
- Backups: estado, ejecucion manual, historial y validacion de restauracion.
- Configuracion fiscal: CAI/rangos, impuesto, datos del hospital y recibo.
- Usuarios/roles: administracion si el modulo existe.

## POS obligatorio

El POS no puede mostrar los 122 servicios como lista interminable. Debe incluir busqueda rapida, seleccion por categoria, tarjetas o tabla compacta, carrito lateral, resumen de factura, pago claro y recibo institucional.

## Barcode/QR/scan_code

Los servicios deben soportar un identificador escaneable si no existe: `scan_code`, `barcode` o `qr_code`. El frontend puede enviar el codigo escaneado, pero el backend decide servicio, precio, vigencia y reglas fiscales. Nunca se confia en el precio enviado por frontend.

## Catalogo

El catalogo debe administrar categorias, servicios, precio, activo/inactivo, scan_code y la regla especial de Eritropoyetina: medicamento de L.25 gratis si se marca paciente con receta de dialisis.

## Reportes avanzados

Debe existir dashboard gerencial con filtros por fecha, cajero, categoria, metodo y estado. Reportes minimos: ventas por dia/rango, ingresos por metodo de pago, servicios mas vendidos, ingresos por categoria, caja por cajero, facturas anuladas, reimpresiones y backups.

## Bloqueo

Si parece prototipo, si todo esta en una pagina, si facturar no parece POS o si reportes siguen basicos, Fase 12 no esta terminada.
