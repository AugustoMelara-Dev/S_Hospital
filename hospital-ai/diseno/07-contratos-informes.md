# Contrato de pantalla — Informes y auditoría (`/reports`, `/reports/executive`, `/reports/cash`, `/reports/audit`)

Fuente: `ReportsView.tsx:20-220`, `ReportsExecutive.tsx:33-320`, `ReportsCash.tsx:23-283`, `ReportsAudit.tsx:113-486`, `components/*` (ExecutiveSummary, TrendChart, PaymentMethodPanel, ServiceRanking, PendingAgingPanel, CashSessionReportPanel, AuditSummaryPanel, ReportExportMenu), `modules/reports/components/AccountingPolicyPanel.tsx`.
Guard: alguna de `reports.managerial.view` | `reports.cash_session.view` | `audit.view` (`appNavigation.ts:123-138`). Exportación: `reports.export`.

## REP-1 · Propósito por sección

| Sección | Contenido | Permiso de lectura | Evidencia |
|---|---|---|---|
| Resumen (`/reports/executive`) | cobros, pendientes, ticket promedio, tendencia, servicios, aging, política contable | `reports.managerial.view` | `ReportsView.tsx:20-26`; `ReportsExecutive.tsx:76-80` |
| Caja (`/reports/cash`) | sesiones, cajeros, métodos, diferencias | `reports.cash_session.view` o `reports.managerial.view` | `ReportsView.tsx:27-32,116-131`; `ReportsCash.tsx:225` |
| Auditoría (`/reports/audit`) | anulaciones, reversos, cambios de precio, fiscales, respaldos; bitácora filtrable | `audit.view` | `ReportsView.tsx:33-39`; `ReportsAudit.tsx:198` |

## REP-2 · Navegación interna y permisos

- Pestañas tipo tarjeta con `aria-current="page"` y descripción por `aria-describedby` (`ReportsView.tsx:157-178`).
- Si el usuario pide una sección sin permiso, cae a otra permitida (`ReportCash`/`Executive`/`Audit` según capacidades) con `permittedReportRoute` (`:91-114`); la URL no cambia, la sección activa sí. Contrato: no mostrar "no tiene permiso" cuando existe sección alternativa; explicar en su lugar qué se muestra.
- Raíz `/reports` muestra `PageHeader` "Informes y auditoría"; en subrutas el encabezado de sección pasa a nivel 1 (`:60-72,182-219`). Debe existir exactamente un `h1` por combinación.

## REP-3 · Estados obligatorios

| Estado | Comportamiento actual | Evidencia | Contrato Tanda 2 |
|---|---|---|---|
| Carga | spinner "Cargando reporte ejecutivo..." / "Cargando..." en caja/bitácora | `ReportsExecutive.tsx:236-238`; `ReportsCash.tsx`; `ReportsAudit.tsx` | conservar |
| Vacío de permiso | `Empty` "Reporte ejecutivo no disponible" con permiso sugerido | `ReportsExecutive.tsx:76-80` | conservar lenguaje humano |
| Vacío de datos | paneles con estados propios (aging, ranking, bitácora "Sin entradas") | `ReportsAudit.tsx:77`; `PendingAgingPanel` | conservar |
| Error | alerta destructiva + "Reintentar"; en caja error de reporte por id | `ReportsExecutive.tsx:232-234`; `ReportsCash.tsx:59-63` | conservar datos previos si existen |
| Rango inválido | alerta "Rango ejecutivo no válido" + validación 92 días | `ReportsExecutive.tsx:63-68,228-230,276-298` | conservar límites; no inventar periodos |
| Exportando | botones deshabilitados con estado `exporting` | `ReportsExecutive.tsx:62,121,171` | conservar |
| Datos largos | tablas y bitácora paginada; gráficos con tabla alternativa | `ReportsAudit.tsx:77`; `design-system/patterns/Chart.tsx` | conservar paridad gráfico/tabla |

## REP-4 · Filtros, aplicación y exportación

- Filtros viven en URL: `from`/`to` (ejecutivo), `cash_session_id` (caja), `action/from/to/page` (auditoría). La URL se normaliza al montar (`ReportsExecutive.tsx:46-61`).
- Cambios sin aplicar se detectan (`hasUnappliedChanges`, `:69`); exportar exige aplicar primero: "Aplique el periodo antes de exportar..." (`:113-120,163-170`).
- Sin `reports.export`: mensaje "Exportacion PDF requiere permiso de exportacion de reportes." (`:101-107,152-157`).
- Export abre PDF en pestaña con fallback y descarga Excel (`:129-147,179-198`); usar `openBlobInNewTab` con su fallback (`lib/download.ts:12-23`).
- Caja: con `cash_session_id` inválido muestra "Ingrese un numero de caja valido." y no carga (`ReportsCash.tsx:77-83`); selector de sesiones recientes solo con `canBrowseCashSessions` (`:88-130`).
- Auditoría: filtro por acción con sinónimos humanos ("anulación" → `invoice.voided`) (`ReportsAudit.tsx:94-104`); el usuario no necesita conocer códigos técnicos. Contrato: conservar o mejorar, nunca empeorar a jerga técnica.
- Bitácora expone IP y entidad solo en pantalla; es información operativa, no pública (ver F029/hs-security). Contrato UX: no copiar IP a reportes exportables sin decisión de seguridad.

## REP-5 · Teclado/foco

- Controles con labels; `ReportScope` con `aria-label` ("Alcance del reporte ...") y marca de actualización (`ReportsExecutive.tsx:218-226`).
- Gráficos: contenedor con nombre accesible y tabla HTML alternativa (clasificación manual de axe en `e2e/accessibility.spec.ts:660-689`). Contrato: ningún gráfico sin alternativa textual.
- Orden de tabulación: filtros → aplicar → exportar → contenido; estados ocupados con `aria-busy`/`disabled`.
- `Escape` no aplica filtros ni exporta.

## REP-6 · Diferenciación sin color

- Badges textuales "Con error"/"Completado" en bitácora (`ReportsAudit.tsx:70-73`).
- Alertas con título ("Rango ejecutivo no válido", "No se pudo cargar...").
- Números con `tabular-nums`; los deltas de comparación deben incluir signo y texto, no solo flecha/color (revisar `ExecutiveSummary` en Tanda 2).

## REP-7 · Criterios de aceptación Tanda 2

1. Un `h1` por sección; la raíz no duplica encabezados.
2. Selección automática de sección permitida sin mostrar callejón de permiso.
3. Exportaciones deshabilitadas y explicadas sin `reports.export`; nunca iniciar export sin periodo aplicado.
4. Rango máximo respetado con mensaje humano; sin recálculo de dinero en cliente.
5. Gráficos con tabla/leyenda alternativa; sin overflow en matriz de viewports ni a zoom 125/200.
6. Errores conservan filtros y datos previos.

## REP-8 · Pendiente de inspección manual

- Legibilidad de gráficos Recharts en claro/oscuro a 1366x768 y 390x844.
- Anchura de la bitácora con IPs y motivos largos.
- Primera pantalla del ejecutivo: KPIs y tendencia visibles sin scroll a 1366x768 (regla "primera ventana" de `docs/superpowers/specs/2026-07-14-operational-ux-correction-design.md:237-313`).
