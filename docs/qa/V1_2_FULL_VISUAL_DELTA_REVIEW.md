# V1.2 Full Visual Delta Review

Fecha: 2026-06-29

## Resultado

PASS con advertencia: el cambio visual grande proviene de la base `origin/codex/v1-2-visible-ui-delta`, clasificada como UTIL COMO BASE. Esta fase refuerza el sistema visual con tokens faltantes, componentes exactos, plataforma de tablas y QA full.

## Evidence

Before:

- `qa/v1-2-full-ux-ui-redesign/before` contiene captura parcial del runtime LAN.
- `qa/v1-2-visible-ui-delta/before` conserva evidencia previa de la fase visual inicial.

After:

- `qa/v1-2-full-ux-ui-redesign/after`
- Capturas completas generadas contra Playwright/Vite local con API mockeada.
- Manifiesto: `qa/v1-2-full-ux-ui-redesign/after/rc-e2e-mocked-report.json`, generado el 2026-06-29T01:45:35Z, `console_issues: []`.

Pantallas after capturadas:

- login light/dark
- cambio obligatorio de contraseña light/dark
- dashboard light/dark
- nueva factura empty/cart
- payment modal
- invoice confirmation
- cashbox open/close dialog
- invoice history
- reports admin light/dark, cash, services
- receipt settings/preview light/dark/A5
- catalog
- backups
- fiscal settings
- users light/dark
- help/support/about
- 404
- access denied
- mobile dashboard/billing/reports

## Diferencia visible

- Design system centralizado con tokens nuevos: hospital surface/panel/border, operational ring, chart 7/8, receipt paper/muted, panel/command shadows, radius card.
- Componentes exactos agregados: `ModuleHeader`, `CommandCenterHeader`, `PrimaryActionPanel`, `ChartLegend`, `OfflineState`, `QuickActionTile`, `SummaryRail`, `MobileStickyActionBar`.
- Tablas principales migradas al wrapper `DataTable` con TanStack Table debajo: reportes/cajeros, reportes/areas, historial de facturas y usuarios.
- Estados visuales y tablas usan patrones compartidos en lugar de loops locales.
- Delta adicional aplicado sobre la base integrada: `PermissionBadge`, paginacion real de `DataTable`, sorting/visibilidad opt-in, utilidades `status-*` reales, `cash-layout` definido y columna de acciones de historial protegida contra recorte.
- Evidencia after reforzada con `support-light.png`; el mock de produccion cubre `/api/system/status-summary` para que Soporte no dependa del backend real durante capturas.

## PASS/FAIL por superficie

| Pantalla | Estado |
| --- | --- |
| Dashboard | PASS |
| POS | PASS |
| Reportes | PASS |
| Caja | PASS |
| Historial | PASS |
| Recibos/settings | PASS |
| Catalogo | PASS |
| Usuarios/RBAC | PASS |
| Login/cambio clave | PASS |
| Backups | PASS |
| Fiscal settings | PASS |
| Help/about/support | PASS |
| 404/acceso denegado | PASS |
| Mobile | PASS |
| Dark mode | PASS |
| Loading/empty/error | PASS |
| Tablas/filtros | PASS |

## Correcciones P1 de auditoria adicional

| Hallazgo | Resultado |
| --- | --- |
| Clases `status-success`, `status-warning`, `status-info` usadas pero no definidas | PASS: definidas en `frontend/src/styles.css` con tokens de estado. |
| `cash-layout` usado sin definicion | PASS: definido en `frontend/src/styles.css`. |
| `DataTablePagination` era un control simbolico deshabilitado | PASS: paginacion real anterior/siguiente con conteo de pagina. |
| Historial podia recortar acciones a la derecha | PASS: columna de acciones con ancho minimo y no ocultable. |
| `PermissionBadge` pendiente en design system | PASS: implementado y probado. |

## Riesgo residual

El host LAN solicitado no paso el gate before completo por desalineacion de heading/runtime. La evidencia after si corresponde a la rama actual.
