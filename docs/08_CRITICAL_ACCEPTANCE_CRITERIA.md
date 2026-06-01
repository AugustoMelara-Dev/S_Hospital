# 08 Critical Acceptance Criteria

## Bloqueantes de producto

- Si parece prototipo, bloqueado.
- Si todo esta en una sola pagina, bloqueado.
- Si no hay navegacion profesional, bloqueado.
- Si los servicios son lista interminable, bloqueado.
- Si facturar no parece POS/caja, bloqueado.
- Si reportes siguen basicos, bloqueado.
- Si scanner/codigo permite confiar en precio del frontend, bloqueado.
- Si catalogo no administra categorias, servicios, estado y scan_code, bloqueado.

## Criterios funcionales

- App shell con sidebar izquierdo, topbar, rutas internas y layout persistente.
- Modulos separados: Nueva factura/POS, Caja, Catalogo, Historial, Reportes avanzados, Backups, Configuracion fiscal y Usuarios/roles si existe.
- POS con busqueda rapida, categorias, servicios compactos, carrito lateral, resumen, pago y recibo institucional media carta/carta/A5/80mm/58mm.
- Catalogo con categorias, servicios, precio, activo/inactivo, scan_code y regla Eritropoyetina.
- Reportes con filtros por fecha, cajero, categoria, metodo y estado.
- Dashboard con metricas claras y tablas legibles.

## Gates minimos antes de cierre

- `php artisan test --colors=never`.
- `npm run build`.
- Smoke manual o automatizado de `/up`, `/login` y `/verify-email` antes de deploy.
- Smoke de navegacion por modulos.
- Smoke POS: crear factura, cobrar, imprimir.
- Smoke reportes: filtrar rango y ver metricas.

## Cierre

Fase 12 solo se acepta cuando el producto se puede mostrar como sistema hospitalario profesional de caja, no como prototipo funcional.
