# Reporte final de bundle del frontend

## Comparación

| Métrica | Antes | Después |
|---|---:|---:|
| JavaScript precargado al inicio, raw | 3,168,914 B | 1,063,100 B |
| JavaScript precargado al inicio, gzip | 945,336 B | 336,589 B (328.7 KiB) |
| Total JavaScript, gzip | 931,073 B | 1,078,579 B (1,053.3 KiB) |
| Rutas lazy | 11 | 13, incluyendo Nueva factura y Caja |
| AG Grid en arranque | Sí | No |
| ECharts en arranque | Sí | No |

El arranque bajó 64.4 % en gzip. El total incluye los motores operativos que ahora se descargan sólo al abrir sus rutas.

## Chunks de inicio

| Chunk | Raw | Gzip | Decisión |
|---|---:|---:|---|
| `index-*` | 469.5 KiB | 143.4 KiB | Shell y Ant Design compartido; queda bajo 500 KiB raw. |
| `clientIssueLog-*` | 445.6 KiB | 144.7 KiB | React, contexto y telemetría local compartida; queda bajo 500 KiB raw. |
| `react-router-*` | 48.3 KiB | 16.9 KiB | Grupo semántico estable que evita superar 500 KiB en el entrypoint. |
| Resto del inicio | 55.8 KiB | 23.7 KiB | API, TanStack Query, locale y utilidades pequeñas. |

## Chunks pesados asíncronos

| Chunk | Raw | Gzip | Ruta/consumidor | Dependencia principal | Decisión |
|---|---:|---:|---|---|---|
| `InstitutionalDataGrid-*` | 845.9 KiB | 234.3 KiB | Catálogo, usuarios, historial, respaldos, caja y reportes | AG Grid Community | Aceptado asíncrono; no existe AG Grid Enterprise ni duplicación. |
| `ReportsView-*` | 600.1 KiB | 200.0 KiB | `/reports/*` | Apache ECharts modular | Aceptado asíncrono; usa `echarts/core`, componentes seleccionados y `CanvasRenderer`. |

Vite conserva un warning sólo por estos dos chunks raw mayores de 500 KiB. No se elevó `chunkSizeWarningLimit`: ambos son asíncronos, no forman parte del arranque, su coste está medido y corresponden a los dos motores obligatorios. El gate de presupuesto aprueba 328.7 KiB gzip inicial contra 488.3 KiB y 1,053.3 KiB gzip total contra 1,074.2 KiB.

## Decisiones aplicadas

- Las 13 rutas funcionales se cargan con `React.lazy`; la caja rápida también se monta bajo `Suspense`.
- El grupo `react-router` usa `output.codeSplitting` de Rolldown, sin agrupar Ant Design ni forzar dependencias de rutas lazy al inicio.
- AG Grid Community permanece fuera del arranque; no hay paquetes Enterprise.
- ECharts se importa modularmente desde `echarts/core`.
- Se retiraron Radix, Lucide, Recharts, Sonner, Vaul, cmdk, Motion, React Day Picker y TanStack Table/Virtual.
- Las fuentes IBM Plex Sans son locales y conservan subconjuntos con `unicode-range`.

Evidencia: `npm run analyze:bundle` terminó con `Bundle budget: PASS`.
