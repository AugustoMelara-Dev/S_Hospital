# V1.2 Exploration Notes

Fecha: 2026-06-26

Estas notas consolidan auditorias solo lectura realizadas antes de tocar UI productiva. Sirven como contrato operativo para subagentes y revisores.

## Design system

- `frontend/src/styles.css` ya tiene tokens base, estados, navegacion, radios, sombras y print de recibos.
- Faltan tokens V1.2: hospital primary/accent, operational bg/surface/panel/border, chart 1..6, receipt border, operational shadow, panel radius y panel spacing.
- `frontend/src/components/shared` no existe; V1.2 debe crearlo para patrones operativos.
- Reutilizar `PageHeader`, `ActionBar`, `FilterBar`, `FormSection`, `MetricCard`, `DataTable`, `Table`, estados, badges, dialogs e inputs; no reescribirlos.
- Crear o adaptar `AppSurface`, `PageShell`, `CommandPanel`, `WorkflowPanel`, `ChartCard`, `InfoPanel`, `PermissionState`, `OperationalBanner`, `CashStatusCard`, `ReceiptDocumentShell` y `PrintPreviewFrame`.
- Definir clases `status-success`, `status-warning`, `status-info` y `print-hidden`, porque ya se usan o se esperan en pantallas/shell.
- Riesgos principales: dark mode, print, charts con estilos inline y componentes con focus/labels.

## Shell y navegacion

- No cambiar paths ni orden base de navegacion: `/dashboard`, `/billing/new`, `/cashbox`, `/catalog`, `/invoices`, `/reports`, `/backups`, `/settings/fiscal`, `/settings/institutional-receipts`, `/admin/users`, `/help`.
- No cambiar permisos ni modos de rutas. En especial:
  - `/billing/new` requiere modo `all` para `invoices.create`, `catalog.view`, `cash.view`, `payments.create`, `receipts.view`.
  - `/reports` requiere modo `any` entre permisos de reportes.
- Mejoras visuales seguras: header institucional mas fuerte, estado de caja mas prominente, active state menos sutil, drawer movil mas limpio, user menu con rol/caja/hospital mejor separados.
- Riesgos: romper `aria-current`, foco al cerrar mobile nav, breadcrumbs con links sin permiso, botones icon-only sin nombre.
- Tests focales: `AppShell.test.tsx`, `AppShell.a11y.test.tsx`, `appNavigation.test.ts`.

## Dashboard, POS y reportes

- Header disperso: dashboard/reportes usan `PageHeader`, POS tiene header manual.
- KPI duplicado: dashboard usa `MetricCard`, reportes tiene `KPICard` propio y executive cards manuales.
- Cards/estados duplicados: `DashboardSectionCard` tiene loading/error/empty/permission; reportes/POS repiten variantes.
- Filtros y export actions se repiten entre tabs de reportes.
- Charts duplican colores/tooltips y algunos apagan `accessibilityLayer`.
- No tocar: reducer POS, `posMath`, payloads, creacion/cobro/anulacion, endpoints o contratos backend.
- Riesgos de datos: no formatear conteos como dinero, no presentar agregaciones frontend como totales contables autoritativos, no convertir respuestas incompletas en ceros reales sin indicarlo.

## Pruebas recomendadas por fase

- Design system: `npm run typecheck`, `npm run lint`, tests de `ui`/`shared`, `npm run build`.
- Shell: `npm run test -- AppShell appNavigation --run`, `npm run typecheck`, `npm run lint`.
- Dashboard/POS/reportes: tests focales de cada feature y Playwright visual/a11y.

## Regla de avance

Primero integrar design system. Despues shell. Luego dashboard/POS/reportes pueden migrar patrones compartidos sin duplicar estilo.
