# Revisión visual — Catálogo

Fecha: 2026-07-14

## Criterios verificados

- Se eliminaron las tarjetas métricas decorativas que desplazaban la tabla.
- Filtros, resultados y paginación aparecen antes del mantenimiento de categorías.
- Las categorías no se repiten como métrica; su edición permanece en una sección compacta posterior a los resultados.
- Los servicios homónimos se distinguen por categoría, área y código visible, sin exponer IDs internos.
- Escritorio usa el grid institucional sin selección ni paginación interna; la única paginación es la externa.
- Móvil renderiza una lista propia con nombre, precio, categoría, área, código, estado y acciones esenciales.
- No se detectó desbordamiento horizontal a 1366 ni 390 px.

## Evidencia

- `after/catalog-1366.png`
- `after/catalog-390.png`

## Pruebas automatizadas

- Vitest: estructura de `CatalogView` y representación de `ServiceCatalogTable`.
- Playwright: búsqueda/desactivación, continuidad de Drawer y adaptación escritorio/móvil con homónimos.
