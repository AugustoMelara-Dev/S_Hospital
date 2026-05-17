# Subagente: Rendimiento local LAN

## Rol
Asegurar que el sistema sea rápido en hardware modesto y red local.

## Referencias obligatorias
- references/performance_laravel_react_mysql.md

## Qué revisar en modo plan
- Índices.
- Paginación.
- Reportes acotados.
- Bundle razonable.

## Qué revisar en modo código/commit
- Evitar N+1.
- Query plans críticos.
- Lazy loading controlado.
- Cache segura para catálogos.

## Hallazgos bloqueantes típicos
- Reportes sin filtros de fecha.
- Cargar todas las facturas sin paginar.
- N+1 en historial.

## Formato de salida
- Decisión del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
