# V1.2 Full Design System

Fecha: 2026-06-28

## Objetivo

Centralizar el lenguaje visual de S_Hospital para que dashboard, POS, reportes, caja, historial, recibos, catalogo, usuarios, backups, settings, help/about, 404 y acceso denegado compongan los mismos tokens y componentes.

## Tokens requeridos

Los tokens viven en `frontend/src/styles.css` bajo `@theme` y `html.dark`.

- Institucionales: `hospital-primary`, `hospital-accent`, `hospital-surface`, `hospital-panel`, `hospital-panel-muted`, `hospital-border`.
- Operacionales: `operational-bg`, `operational-surface`, `operational-panel`, `operational-ring`, `operational-border`.
- Charts: `chart-1` a `chart-8`.
- Recibos: `receipt-border`, `receipt-paper`, `receipt-muted`.
- Elevacion y radios: `shadow-panel`, `shadow-command`, `shadow-operational`, `radius-panel`, `radius-card`.

## Componentes requeridos

| Componente | Estado | Uso |
| --- | --- | --- |
| `AppSurface` | Existe. | Superficie raiz offline/LAN. |
| `PageShell` | Existe. | Contenedor principal responsive. |
| `ModuleHeader` | Wrapper de `SectionHeader`. | Header estandar para modulos. |
| `CommandCenterHeader` | Nuevo. | Dashboard/reportes con estado operacional. |
| `OperationalBanner` | Existe. | H1 institucional por modulo. |
| `WorkflowPanel` | Existe. | Flujos de POS, caja y settings. |
| `PrimaryActionPanel` | Nuevo. | Acciones dominantes de caja/POS. |
| `MetricCard` | Existe. | KPIs y totales. |
| `StatGrid` | Existe. | Grids de indicadores. |
| `ChartCard` | Existe. | Charts Recharts con caption. |
| `ChartLegend` | Nuevo. | Leyendas consistentes. |
| `DataTable` | Migrado a TanStack Table. | Tablas robustas. |
| `DataTableToolbar` | Nuevo. | Search, visibility y acciones. |
| `DataTablePagination` | Nuevo. | Resumen/paginacion accesible. |
| `DataTableEmpty` | Nuevo. | Empty state dentro de tabla. |
| `FilterBar` | Existe. | Filtros por modulo. |
| `ActionBar` | Existe. | Acciones compactas. |
| `FormSection` | Existe. | Formularios con secciones. |
| `FieldGroup` | Existe. | Agrupacion de campos. |
| `MoneyText` | Existe. | Montos tabulares. |
| `StatusBadge` | Existe. | Estados de negocio. |
| `PermissionBadge` | Pendiente si RBAC requiere variante propia. | Permisos visibles. |
| `EmptyState` | Existe. | Estados vacios. |
| `ErrorState` | Existe. | Errores recuperables. |
| `LoadingState` | Existe. | Carga. |
| `OfflineState` | Nuevo. | Estado LAN/offline. |
| `PermissionState` | Existe. | Acceso restringido. |
| `CashStatusCard` | Existe. | Estado de caja. |
| `ReceiptDocumentShell` | Existe. | Documento papel. |
| `PrintPreviewFrame` | Existe. | Preview de recibo. |
| `QuickActionTile` | Nuevo. | Acciones rapidas dashboard/POS. |
| `SummaryRail` | Nuevo. | Resumen lateral POS/reportes. |
| `MobileStickyActionBar` | Nuevo. | Accion principal en mobile. |

## Reglas de composicion

- Las pantallas deben usar componentes compartidos antes de clases locales.
- Las tablas principales deben usar `DataTable` y no construir headers/rows desde cero salvo tablas pequenas de detalle.
- Los charts deben vivir dentro de `ChartCard` con alto estable y fallback textual.
- Los formularios deben usar `FormSection`/`FieldGroup` y errores asociados.
- Los recibos deben usar `ReceiptDocumentShell` y print tokens; papel blanco siempre en impresion.
- No introducir datos clinicos, legales o fiscales no existentes.
