# Línea base de ejecución — refactor total del frontend

Fecha de captura: 2026-07-12. Alcance inspeccionado: `frontend/` y
`docs/frontend-total-refactor-plan.md`. Esta línea base es estática: no ejecuta ni
modifica la aplicación y no convierte las afirmaciones del plan en hechos sin
contrastarlas con el árbol actual.

## Convenciones de conteo

- **TS/TSX total**: todos los `.ts` y `.tsx` bajo `frontend/src`.
- **Prueba unitaria/componente**: nombre `*.test.ts`, `*.test.tsx`, `*.spec.ts` o
  `*.spec.tsx`.
- **Producción**: TS/TSX excluyendo pruebas, `src/test/`, `src/stories/` y
  `*.stories.*`.
- **Componente productivo TSX**: archivo `.tsx` incluido en producción. Es una
  aproximación por archivo, no un conteo de símbolos React exportados.
- **Uso/import legacy**: archivo productivo que contiene el import o ruta indicada;
  no es el número de ocurrencias ni demuestra que el código se alcance en runtime.
- **Formulario**: archivo productivo con `<form>`; RHF se reporta por separado.
- **Overlay**: consumidor productivo de wrappers locales de dialog/drawer/sheet,
  alert/confirm dialog, popover, dropdown, tooltip o command.
- **Tabla/grid**: HTML `<table>`, wrapper `DataTable`, o `AgGridReact`; el simple
  uso CSS de `grid-cols-*` se separa porque es layout, no una grilla de datos.

## Resumen verificable

| Métrica | Árbol actual | Nota |
|---|---:|---|
| TS/TSX en `src` | 397 | 130 `.ts` + 267 `.tsx` |
| Archivos de producción | 253 | 82 `.ts` + 171 `.tsx` |
| Pruebas unitarias/componente | 135 | 8 son `*.a11y.test.tsx`; 6 son de arquitectura |
| Infraestructura adicional en `src/test` | 2 | `setup.ts` y `vitest-axe.d.ts`; explica 137 archivos bajo la definición amplia usada durante auditoría |
| Stories TS/TSX | 7 | además existen assets/MDX/CSS que no entran aquí |
| Specs E2E | 26 | `frontend/e2e/*.spec.ts`, no recursivo |
| `components/ui` total | 62 | 50 productivos + 12 pruebas |
| Componentes productivos TSX | 171 | aproximación por archivo |
| `components/shared` productivos | 2 | `design-system.tsx`, `index.ts` |
| Consumidores productivos de `components/shared` | 16 | adopción parcial |
| Formularios con `<form>` | 16 | 12 archivos importan `react-hook-form` |
| Consumidores de overlays locales | 22 | definición indicada arriba |
| HTML `<table>` | 5 archivos | incluye el primitive y previews/visualización |
| `DataTable` o import del wrapper | 11 archivos | incluye el propio wrapper |
| AG Grid productivo | 0 archivos | paquete instalado, sin import productivo |
| Layout CSS `grid-cols-*` | 61 archivos | no confundir con data grids |
| Recharts productivo | 3 archivos | wrapper + 2 gráficos de reportes |
| ECharts productivo | 0 archivos | paquete instalado, sin import productivo |
| Entradas sucias de Git en `frontend` | 164 | 147 modificadas + 17 no rastreadas |

## Discrepancias con el plan

1. El diagnóstico del plan dice **381 TS/TSX**; el árbol actual contiene **397**.
   Sin una definición/exclusión histórica en el plan, la cifra no es reproducible.
2. “**62 componentes manuales** en `components/ui`” es el número total de archivos,
   no de componentes productivos: son **50 archivos productivos y 12 pruebas**.
3. El plan afirma **233 archivos modificados localmente**. La captura actual de
   `git status --porcelain -- frontend` da **164 entradas**. La cifra es temporal y
   debe registrarse por commit/fecha si se usa como criterio.
4. El plan anuncia un inventario de **39 áreas**, pero el documento contiene solo
   **15 encabezados `### Módulo`**. No hay 39 fichas auditables.
5. La arquitectura objetivo ya figura en dependencias (`antd`, AG Grid, ECharts),
   pero la migración no está consumada: **0 usos productivos de AG Grid**, **0 de
   ECharts**, frente a `DataTable`/HTML y Recharts todavía activos.
6. “Ant Design como suite dominante” aún no describe el código: solo **12 archivos
   productivos** importan `antd`, mientras **90** referencian `components/ui/` y
   **82** importan `lucide-react`.
7. El plan trata `/login` como ruta renderizada por `AppRoutes`, pero una sesión no
   autenticada se resuelve condicionalmente en `App.tsx`; dentro de `AppRoutes`,
   `/login` redirige a la ruta autenticada por defecto. El cambio obligatorio de
   contraseña también es una vista condicional, no una ruta canónica.
8. El plan presenta reportes como ECharts. La evidencia actual es
   `components/ui/chart.tsx`, `PaymentMethodPanel.tsx` y `TrendChart.tsx` importando
   Recharts.

## Rutas reales y evidencia por ruta

Fuente canónica: `frontend/src/navigation/appNavigation.ts`; montaje:
`frontend/src/AppRoutes.tsx`. Hay **13 rutas de dominio canónicas**, más `/`,
`/login`, wildcard y tres subrutas de reportes.

| Ruta | Entrada efectiva | Evidencia relevante actual |
|---|---|---|
| condicional sin sesión | `features/auth/LoginView.tsx` | `<form>`; no es `/login` montado dentro de `AppRoutes` |
| condicional contraseña | `features/auth/PasswordChangeView.tsx` | `<form>` + RHF; sin ruta propia |
| `/dashboard` | `features/dashboard/DashboardView.tsx` | `SetupWizardDialog`; `TodayLedger`; consumidor de `DataTable` desde la vista |
| `/billing/new` | `features/invoices/NewInvoiceView.tsx` | overlays en `PaymentModal`, `InvoiceConfirmation`, `InvoiceSuccess`; carrito denso, no AG Grid |
| `/cashbox` | `features/cash/CashBoxView.tsx` | `OpenSessionForm`, `CashClosingPanel`, `CloseSessionDialog`; `CashMovementsTable` usa DataTable |
| `/catalog` | `features/catalog/CatalogView.tsx` | `CategorySheet` y `ServiceSheet`; `ServiceCatalogTable` usa DataTable |
| `/invoices` | `features/invoices/InvoiceHistoryView.tsx` | `InvoiceDetailSheet`; `InvoiceHistoryTable` usa DataTable |
| `/reports/*` | `features/reports/ReportsView.tsx` | subrutas `/executive`, `/cash`, `/audit`; Recharts en `TrendChart` y `PaymentMethodPanel` |
| `/backups` | `features/backups/BackupsView.tsx` | confirm/dialog local; `BackupHistoryTable` usa DataTable |
| `/settings/fiscal` | `features/settings/FiscalSettingsView.tsx` | agrega vistas fiscal/hospital/operacional; `FiscalNumerationView` tiene formulario y overlay |
| `/settings/institutional-receipts` | `features/receipt-settings/InstitutionalReceiptSettingsView.tsx` | `<form>` + RHF; preview contiene HTML tabular |
| `/admin/users` | `features/admin/UsersView.tsx` | formularios/overlays de usuario, rol y contraseña; `UsersTable` usa DataTable; `PermissionMatrix` usa HTML table |
| `/support` | `features/support/SupportCenterView.tsx` | no aparece en navegación primaria (`navigation: false`) |
| `/help` | `features/help/HelpView.tsx` | ruta primaria sin permiso requerido |
| `/about` | `features/about/AboutView.tsx` | no aparece en navegación primaria (`navigation: false`) |
| `/` | `AppRoutes.tsx` | redirige a `/dashboard` |
| `/login` autenticado | `AppRoutes.tsx` | redirige a `defaultAuthenticatedRoute` |
| `*` | `NotFoundView` en `AppRoutes.tsx` | estado 404 mediante `RouteState` |

No se hallaron rutas montadas para `AreaPaidServicesView.tsx`, `BrandingView.tsx` ni
`FiscalNumerationView.tsx` como páginas independientes; las dos últimas pueden ser
descendientes de configuración. `GuidedTour.tsx` es overlay/onboarding, no ruta.

## Inventario por tipo con evidencia

### Formularios

Los 16 archivos con `<form>` son:

`components/ui/filter-bar.tsx`; `features/admin/components/PasswordResetDialog.tsx`;
`RoleFormDialog.tsx`; `UserFormDialog.tsx`; `features/auth/LoginView.tsx`;
`PasswordChangeView.tsx`; `features/cash/components/CashClosingPanel.tsx`;
`OpenSessionForm.tsx`; `features/catalog/components/CategorySheet.tsx`;
`ServiceSheet.tsx`; `features/invoices/components/PaymentModal.tsx`;
`features/receipt-settings/InstitutionalReceiptSettingsView.tsx`;
`features/reports/ReportsAudit.tsx`; `features/reports/components/CashSessionReportPanel.tsx`;
`features/settings/FiscalNumerationView.tsx`; `HospitalSettingsView.tsx`.

RHF aparece en 12 archivos productivos. No todos los formularios usan RHF y algunos
subcomponentes de secciones importan RHF sin poseer el `<form>` raíz.

### Overlays

Hay 22 consumidores productivos de wrappers locales. Evidencia concentrada:

- shell/global: `App.tsx`, `components/keyboard-shortcuts-palette.tsx`;
- admin: cinco dialogs de `features/admin/components/`;
- catálogo: `CatalogView.tsx`, `CategorySheet.tsx`, `ServiceSheet.tsx`;
- facturación/historial: `PaymentModal.tsx`, `InvoiceConfirmation.tsx`,
  `InvoiceSuccess.tsx`, `NewInvoiceViewLayout.tsx`, `InvoiceDetailSheet.tsx`,
  `InvoiceHistoryView.tsx`;
- otros: `BackupsView.tsx`, `CashBoxView.tsx`, `SetupWizardDialog.tsx`,
  `GuidedTour.tsx`, `FiscalNumerationView.tsx`, `HospitalSettingsView.tsx`.

### Tablas, grids y gráficos

- DataTable: `UsersTable`, `BackupHistoryTable`, `CashMovementsTable`,
  `ServiceCatalogTable`, `InvoiceHistoryTable`, `CashSessionReportPanel`,
  `PaymentMethodPanel`, `PendingAgingPanel`, `FiscalSequencesTable`, además del
  wrapper y su consumo desde `DashboardView`.
- HTML table: primitive `components/ui/table.tsx`, `PermissionMatrix.tsx`,
  `ReceiptPreview.tsx`, `ReceiptSettingsPreview.tsx`, `TrendChart.tsx`.
- AG Grid: ninguna evidencia productiva.
- Recharts: `components/ui/chart.tsx`, `PaymentMethodPanel.tsx`, `TrendChart.tsx`.
- ECharts: ninguna evidencia productiva.

### Shared y legacy

`components/shared` contiene dos archivos productivos y tiene 16 consumidores.
El legado continúa presente por archivos productivos: Radix **21**,
TanStack Table **1**, Lucide **82**, Sonner **4**, Motion **2**, cmdk **1**,
Recharts **3**. Además, **90** archivos productivos referencian `components/ui/`.
Estas categorías se solapan y no deben sumarse.

## Comandos reproducibles

Ejecutar desde `C:\Projects\S_Hospital` en PowerShell:

```powershell
# Total TS/TSX
(Get-ChildItem frontend/src -Recurse -File |
  Where-Object Extension -in '.ts','.tsx').Count

# Pruebas por nombre
(Get-ChildItem frontend/src -Recurse -File |
  Where-Object Name -match '\.(test|spec)\.(ts|tsx)$').Count

# UI total y UI productivo
(Get-ChildItem frontend/src/components/ui -File).Count
(Get-ChildItem frontend/src/components/ui -File |
  Where-Object Name -notmatch '\.(test|spec)\.').Count

# E2E
(Get-ChildItem frontend/e2e -File -Filter '*.spec.ts').Count

# Rutas y subrutas
rg -n 'path:|<Route|SUB_ROUTES' frontend/src/navigation/appNavigation.ts `
  frontend/src/AppRoutes.tsx frontend/src/features/reports/ReportsView.tsx

# Formularios, tablas y motores
rg -l '<form\b' frontend/src -g '*.tsx' -g '!*.test.*' -g '!*.stories.*'
rg -l '<table\b|DataTable|AgGridReact|ag-grid-react' frontend/src `
  -g '*.tsx' -g '!*.test.*' -g '!*.stories.*'
rg -l 'recharts|from [''\"]echarts|ag-grid-react' frontend/src `
  -g '*.ts' -g '*.tsx' -g '!*.test.*' -g '!*.stories.*'

# Imports legacy y shared (repetir sustituyendo PATRON)
rg -l 'PATRON' frontend/src -g '*.ts' -g '*.tsx' `
  -g '!*.test.*' -g '!*.spec.*' -g '!*.stories.*' -g '!test/**' -g '!stories/**'
# Patrones: @radix-ui/ ; @tanstack/react-table ; recharts ; lucide-react ;
# sonner ; from 'motion' ; cmdk ; components/ui/ ; components/shared

# Estado temporal del worktree
$s = git status --porcelain -- frontend
$s.Count
($s | Where-Object { $_ -match '^ M|^M ' }).Count
($s | Where-Object { $_ -match '^\?\?' }).Count

# Encabezados reales del plan
rg -n '^### Módulo' docs/frontend-total-refactor-plan.md
```

## Criterio de actualización

Volver a capturar esta línea base antes de iniciar una fase que dependa de cifras
de inventario y después de cada fase de migración. Una reducción válida debe
medirse con las mismas exclusiones. Instalar una dependencia no cuenta como
migración: el criterio mínimo es import productivo, flujo cubierto y eliminación
del consumidor legacy correspondiente.
