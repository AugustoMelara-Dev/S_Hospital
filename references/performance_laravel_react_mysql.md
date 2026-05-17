# Referencia: rendimiento Laravel + React + MySQL en LAN

## Backend
- Usar eager loading controlado para evitar N+1.
- Paginar historial de facturas.
- Reportes siempre con rango de fecha.
- Índices en columnas de filtros.
- Cachear catálogo activo si no cambia frecuentemente.

## Frontend
- TanStack Query con staleTime razonable para catálogo.
- Evitar renders masivos innecesarios.
- Virtualización si tablas crecen mucho.
- Bundle split si el panel crece.

## Reportes
- Agregar agregaciones en SQL.
- No traer todas las facturas al frontend para sumar.
- Exportar CSV/PDF por backend si hay mucho dato.
