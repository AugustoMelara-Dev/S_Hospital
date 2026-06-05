# 00 Executive Reset - Fase 12

## Veredicto

El sistema Sistema de Caja Hospitalaria esta tecnicamente avanzado, pero no puede considerarse producto final mientras su UX/UI parezca prototipo. El core de facturacion, pagos, caja, recibos, historial, backups y reglas fiscales debe conservarse; el problema critico esta en como el usuario opera el sistema.

## Problema principal

Una sola pagina interminable comunica improvisacion. Aunque el backend funcione, una pantalla con modulos apilados, servicios como lista larga y reportes basicos bloquea venta, entrenamiento y confianza operativa.

## Decision de producto

Fase 12 reconstruye la experiencia visible como aplicacion profesional:

- App shell persistente con sidebar izquierdo.
- Topbar con usuario, caja activa, estado LAN/servidor y acciones rapidas.
- Rutas internas por modulo.
- POS de facturacion rapido, no formulario administrativo.
- Catalogo administrable por categorias, servicios, estado y codigos de escaneo.
- Reportes avanzados con metricas, filtros, tablas y exportaciones.
- QA visual y funcional institucional.

## Modulos obligatorios

- Nueva factura / POS.
- Caja.
- Catalogo.
- Historial.
- Reportes avanzados.
- Backups.
- Configuracion fiscal.
- Usuarios/roles si existe en el repo.

## Criterio ejecutivo

Si el sistema sigue pareciendo prototipo tecnico, queda bloqueado aunque las pruebas de backend pasen.
