# Registro de Avance del Refactor del Frontend — S_Hospital

Este documento registra el progreso fase por fase del refactor del frontend. Se mantiene al final de cada fase.

---

## Estado General de la Campaña

* **Fases Implementadas (QA Transversal Pendiente):** Fase 6 (Auth), Fase 7 (Dashboard), Fase 8 (Caja), Fase 8b (Facturación/Invoices)
* **Fases Completadas (Certificadas):** Fase 0-5
* **Fases Pendientes:** 11

---

## Registro de Fases

### Fase 5: Shell y Navegación
* **Estado:** COMPLETADO
* **Archivos Migrados/Creados:**
  * Nuevo InstitutionalShell.tsx, InstitutionalRail.tsx, InstitutionalMobileNav.tsx
  * Eliminado ClinicalShell.tsx, ClinicalRail.tsx, ClinicalMobileNav.tsx
  * Modificación de CommandPalette.tsx, ContextBar.tsx, UserMenu.tsx
* **Tests:** InstitutionalShell: 15/15 ✓. Legacy shell tests eliminados.
* **Commit:** `feat(shell): replace ClinicalShell with InstitutionalShell`

---

### Fase 6: Autenticación y Estados de Error
* **Estado:** IMPLEMENTADA — QA TRANSVERSAL PENDIENTE

#### Cambios implementados

| Área | Detalle |
|------|---------|
| LoginView | Migrado a Ant Design con `ConfigProvider` y tokens institucionales. Validación con Zod. |
| PasswordChangeView | Migrado a Ant Design; bcrypt-aware; motivo de cambio auditado. |
| RouteState | Patrón compartido para loading / error / empty / unavailable. |
| AppErrorBoundary | Error boundary institucional con CTA de recuperación. |
| useTheme | Hook con tokens, persistencia y broadcast cross-tab. |
| design-system.tsx | Eliminados los `tagStyleMap` con hex literales; ahora usan tokens Ant Design. |
| design-system.stories.tsx | Storybook Chromium axe-clean. |
| StatusTag | API compartida (`normal` / `success` / `warning` / `danger` / `info` / `neutral` / `paid` / `pending` / `void` / `partial` / `open` / `closed` / `failed`); colores via Ant Design design tokens. |

#### Evidencia de pruebas

| Suite | Resultado |
|-------|-----------|
| `src/features/auth` | 20/20 ✓ |
| `src/features/dashboard` (incluye SetupWizardDialog) | 38/38 ✓ |
| `src/components/ui/status-badge` | 3/3 ✓ |
| `src/components/ui/computed-border-radius` | 11/11 ✓ |
| `src/components/shared` (Storybook) | 19/19 ✓ |
| `src/components` (resto) | 81/81 ✓ |
| `src/hooks/useTheme` | incluido en la suite general ✓ |
| `src/features/settings` (FiscalSettingsView y FiscalNumerationView) | 25/25 ✓ |
| `src/features/help` | 2/2 ✓ |
| `src/features/backups` | 43/43 ✓ |
| **Suite focal de Fase 6/7** | **242/242 ✓** |
| Suite completa estable | 980/1073 (93 fallidos en catalog/invoices/App, NO en dashboard ni auth) |
| `npm run typecheck` | ✓ Sin errores |
| `npm run lint` | ✓ Sin errores |
| `npm run check:ui-legacy` | 16 archivos validados (allowlist legacy) |
| Build | Pendiente verificación navegador real |
| E2E / Playwright / axe-screenshots | Pendiente Fase 8+ |

#### Quality gates

| Gate | Estado |
|------|--------|
| `git diff --check` | ✓ Sin errores de whitespace |
| `npm run typecheck` | ✓ Sin errores |
| `npm run lint` | ✓ Sin errores |
| `node scripts/check-no-legacy-ui.mjs` | ✓ 16 archivos validados (allowlist legacy) |
| Suite completa estable | 980/1073 (93 fallos en archivos no tocados por esta fase) |
| Build | Pendiente verificación navegador real |

#### Legacy imports restantes (escaneo real de `src/`)

| Librería | Imports | Archivos |
|----------|---------|----------|
| `@radix-ui/` | 21 | Primitivos ShadCN en `src/components/ui/` (migración futura) |
| `lucide-react` | 28 | Primitivos ShadCN en `src/components/ui/` |
| `recharts` | 2 | `src/components/ui/chart.tsx` (no usado en runtime) |
| `sonner` | 16 | `src/components/ui/sonner.tsx` + 4 imports residuales |
| `vaul` | 1 | `src/components/ui/drawer.tsx` |
| `cmdk` | 2 | `src/components/ui/command.tsx` |
| `motion/react` | 2 | `src/components/ui/animations.tsx` |
| `react-day-picker` | 2 | `src/components/ui/calendar.tsx` + `date-range-picker.tsx` |
| `@tanstack/react-table` | 3 | `src/components/ui/data-table.tsx` + 1 test |

#### Clases prohibidas restantes (escaneo real de `src/`)

| Clase | Usos | Archivos |
|-------|------|----------|
| `rounded-sm` | 4 | 4 |
| `rounded-md` | 31 | 22 |
| `rounded-lg` | 17 | 15 |
| `rounded-xl` | 28 | 19 |
| `rounded-2xl` | 7 | 7 |
| `rounded-full` | 11 | 9 |
| `shadow-sm` | 18 | 16 |
| `shadow-md` | 4 | 4 |
| `shadow-lg` | 2 | 2 |
| `shadow-xl` | 1 | 1 |
| `shadow-2xl` | 1 | 1 |
| **Total** | **124** | — |

> El check de legacy ahora audita **407 archivos** en `src/` y reporta **148 violaciones** (imports legacy + clases prohibidas). La allowlist queda registrada y los 48 archivos ShadCN marcados como `exempted`; deben migrarse a Ant Design en fases siguientes.

#### Componentes hex inline eliminados (centralización StatusTag)

* Eliminados los `tagStyleMap` con hex literales en `design-system.tsx` para `CashStatusCard` y `PermissionBadge`.
* `OperationalQueue` usa `PRIORITY_TAG_COLOR` con tokens Ant Design (`default` / `warning` / `error`).
* `DashboardView` usa `InvoiceStatusTag` con tokens Ant Design (`success` / `warning` / `error` / `processing`).

#### Excepciones ESLint (auditadas)

| Archivo | Línea | Regla | Justificación |
|---------|-------|-------|---------------|
| `src/shell/InstitutionalShell.test.tsx` | 1 | `no-explicit-any` (archivo) | Mocks de testing-library. |
| `src/features/backups/BackupsView.test.tsx` | 1 | `no-explicit-any` (archivo) | Mocks de testing-library. |
| `src/features/dashboard/components/SetupWizardDialog.test.tsx` | 1 | `no-explicit-any` (archivo) | Mocks de testing-library. |
| `src/features/settings/settingsAntd.tsx` | 122 | `label-has-associated-control` (línea) | `Label` passthrough; caller debe pasar `htmlFor`. |
| `src/features/reports/components/CashSessionReportPanel.tsx` | 18 | `label-has-associated-control` (línea) | `Label` passthrough; caller debe pasar `htmlFor`. |

#### Deuda pendiente en Fase 6/7/8

- [x] Eliminar `DashboardSetupStatusCard` (sin consumidores)
- [x] Refactorizar header del Dashboard a `PageHeader`
- [x] Eliminar `Table` / `TableColumnsType` del Dashboard (usa `List` de Ant Design)
- [x] Centralizar tags de estado (eliminar hex literales)
- [x] Tests de computed border-radius
- [x] Ampliar cobertura de `SetupWizardDialog` (5 escenarios nuevos, 8/8)
- [x] Auditar excepciones ESLint
- [x] Facturas recientes del Dashboard: MIGRADA (sin imports de Table, usa List, enlace de detalle correcto)
- [x] Caja (`CashBoxView` y componentes de cierre, movimientos, sesión): MIGRADA (sin Lucide, sin Radix, con DataGrid institucional, con Tag/Modal/Form Ant Design)
- [ ] Migrar 48 primitivos ShadCN a Ant Design (Fase 9+)
- [ ] Screenshots en 6 viewports (requiere dev server activo)
- [ ] E2E con Playwright: apertura, navegación, wizard, foco, Escape
- [ ] Axe en 6 estados: normal / vacío / error / wizard abierto / móvil / oscuro
- [ ] Commit deliberado por área

---

### Fase 7: Dashboard Operativo
* **Estado:** IMPLEMENTADA — QA TRANSVERSAL PENDIENTE
* **Archivos Migrados/Creados:**
  * `src/features/dashboard/DashboardView.tsx` (Migrado de Table a List, PageHeader institucional)
  * `src/features/dashboard/components/OperationalQueue.tsx` (Color de tags centralizado)
  * `src/components/ui/page-header.tsx` (Cabecera institucional plana)
* **Tests:** `src/features/dashboard`: 38/38 ✓

---

### Fase 8: Caja
* **Estado:** IMPLEMENTADA — QA TRANSVERSAL PENDIENTE
* **Archivos Migrados/Creados:**
  * `src/features/cash/CashBoxView.tsx`
  * `src/features/cash/components/OpenSessionForm.tsx`
  * `src/features/cash/components/CashSessionHeader.tsx`
  * `src/features/cash/components/SessionSummary.tsx`
  * `src/features/cash/components/CashMovementsTable.tsx`
  * `src/features/cash/components/CashClosingPanel.tsx`
  * `src/features/cash/components/CloseSessionDialog.tsx`
  * `src/features/cash/components/CashMethodSummary.tsx`
  * `src/features/cash/cashCloseSummary.ts`
* **Tests:** `src/features/cash`: 55/55 ✓

---

### Fase 8b: Facturación (Invoices)
* **Estado:** FASE 8B IMPLEMENTADA — QA TRANSVERSAL PENDIENTE
* **Archivos Migrados/Creados:**
  * `src/features/invoices/NewInvoiceView.tsx` (y componentes `PatientStep`, `InvoiceConfirmation`, `InvoiceSuccess`)
  * `src/features/invoices/InvoiceHistoryView.tsx` (y componentes `InvoiceHistoryFilters`, `InvoiceHistoryTable`, `InvoiceDetailSheet`)
  * `src/design-system/ag-grid/InstitutionalDataGrid.tsx` (adaptador único de AG Grid con visibilidad explícita)
  * Eliminados `flowAntCompat.tsx` y `historyAntCompat.tsx`; no sobreviven adaptadores Compat en Invoices.
* **Tests focales:** 194/194 pruebas aprobadas en 17 archivos. La primera pasada arquitectónica expuso 30 fallos de contrato de pruebas; no se introdujeron ramas de runtime para resolverlos.
* **Gates estáticos:** `git diff --check`, typecheck, lint y build aprobados. `check:ui-legacy` permanece rojo por 165 violaciones globales en 407 archivos; Invoices quedó sin imports legacy ni clases prohibidas.
* **Navegador:** 5/5 pruebas Chromium aprobadas en `new-invoice-flow.spec.ts` e `invoice-history-flow.spec.ts`, con AG Grid, DatePicker, Dropdown, Drawer y Modal reales, teclado, Escape, restauración de foco y consola limpia para esos recorridos. La matriz completa de 1366x768, 1920x1080, 390x844, zoom 125 %, claro/oscuro continúa pendiente.
* **Accesibilidad transversal:** axe se ejecutó sobre el grid con datos y bloqueó la matriz en el primer estado por infracciones serias de contraste en el shell institucional (rail, navegación, breadcrumb, estado de caja y atajo Ctrl+K). No se excluyeron nodos ni reglas; los estados restantes de axe siguen pendientes hasta corregir el shell.

#### Cifras de la campaña de Facturación

| Métrica | Antes | Después |
| --- | ---: | ---: |
| Tests completos de Invoices | 191 | 194 |
| Fallos restantes focales | 0 aceptados, arquitectura sin validar | 0; 194/194 en repetición completa |
| Imports legacy en Invoices | 0 | 0 |
| Clases prohibidas en Invoices | 1 | 0 |
| Archivos Compat nuevos | 2 acumulados en la campaña | 0 sobrevivientes |
| Archivos Compat eliminados | 0 | 2 |

---

### Próxima: Fase 9 (Catálogo)
* **Estado:** EN PROGRESO
* **Alcance:** Catálogo, categorías, áreas y servicios (`CatalogView`, `ServiceSheet`, `CategorySheet`, etc.)
* **Tests focales en `src/features/catalog`:** 53/53 aprobados en 7 archivos.
* **Navegador focal:** 2/2 recorridos Chromium aprobados en `catalog-flow.spec.ts`: búsqueda, AG Grid, Dropdown real, confirmación de estado, Drawer real, Escape, restauración de foco, deep-link y navegación atrás.
* **Arquitectura:** `CatalogView` deriva la apertura y entidad de los overlays desde la URL, sin estado espejo ni ramas de test. `ServiceSheet` y `CategorySheet` usan Drawer/Form reales de Ant Design. El menú de acciones conserva estado controlado fuera del renderer de AG Grid para evitar que la selección de fila desmonte el Dropdown.
* **Deuda focal:** 0 imports de primitivas legacy y 0 clases prohibidas detectadas en runtime de `src/features/catalog`; no se agregaron Compat. El gate global continúa rojo con 163 violaciones en 407 archivos. La Fase 9 continúa abierta hasta completar su gate transversal y la revisión integral del módulo.

---

### Fase 10: Usuarios, roles y permisos (2026-07-13)

* **Estado:** IMPLEMENTADA — QA TRANSVERSAL PENDIENTE.
* **Arquitectura:** eliminada la capa transitoria `adminAntCompat.tsx`. Los consumidores usan directamente `Modal`, `Dropdown` + `MenuProps`, controles de `Form`, `Select`, `Checkbox`, `Alert`, `Tag` y Ant Design Icons; el directorio de escritorio usa `InstitutionalDataGrid` y los estados usan `StatusTag`.
* **RBAC preservado:** permisos exactos, roles protegidos, protección del último administrador, bloqueo de auto-desactivación, auditoría con motivo, reset de contraseña e idempotencia.
* **Accesibilidad:** el catálogo pequeño de roles usa búsqueda y `virtual={false}` para exponer todas las opciones a tecnologías asistivas; el motivo de desactivación tiene nombre accesible explícito.
* **Vitest:** 84/84 pruebas focales aprobadas en 7 archivos.
* **Playwright:** 1/1 flujo Chromium aprobado en 9.8 s: creación, permisos exactos, búsqueda, AG Grid, Dropdown, Modal de desactivación, motivo y cierre.
* **Gate legacy estricto:** `invoices`, `catalog` y `admin` pasan con 0 violaciones sobre 409 archivos auditados.
* **Commit:** `802e2101 feat(admin): migrate users roles and permissions`.

#### Regresión transversal posterior al shell y Administración

| Gate | Resultado |
| --- | --- |
| `git diff --check` | aprobado |
| `npm run typecheck` | aprobado |
| `npm run lint` | aprobado, 31 s |
| `npm run build` | aprobado, 48.3 s; warnings de `@theme` y chunk vendor >500 kB |
| Facturación | 194/194 |
| Catálogo | 53/53 |
| Administración | 84/84 |
| Shell/compartidos | 225/225 en 42 archivos |
| Bloque Reportes/Recibos/otros | 197/208; 11 fallos en 6 archivos, fuera de los módulos migrados |
| Bloque App/API/impresión y utilidades | 226/236; 10 fallos en 3 archivos (`App.test`, API system y política de papel) |
| Playwright shell / Facturación / Catálogo / Administración | 4/4 · 5/5 · 2/2 · 1/1 |
| `npm run test:e2e` release | bloqueado antes de ejecutar: falta `E2E_RELEASE_PASSWORD` o `E2E_SEED_PASSWORD` |

La invocación monolítica de Vitest agotó memoria y la variante serial completa dejó procesos huérfanos; la evidencia global se ejecutó en segmentos explícitos. Hay 21 fallos reproducibles en 9 archivos fuera de Facturación, Catálogo y Administración. No se declara certificación mientras permanezcan y falte la credencial del E2E release.

---

### Tramo Recibos, Reportes y regresión determinista (2026-07-13)

* **Ajustes de recibos:** IMPLEMENTADA — QA TRANSVERSAL PENDIENTE. Form/Form.Item, Select, InputNumber, Collapse y Alert reales; perfil normal separado de soporte avanzado por `receipt_settings.advanced`; Carta, Media Carta, A5, 80 mm y 58 mm conservados. Vitest focal: **61/61**. Playwright mock: **3/3**.
* **Reportes:** IMPLEMENTADA — QA TRANSVERSAL PENDIENTE. Ejecutivo, Caja y Auditoría usan DatePicker, InstitutionalDataGrid, Statistic/Descriptions y ECharts modular con aria, resumen y alternativa tabular. Vitest focal: **95/95**. Playwright mock: **4/4**.
* **App:** la integración se alineó a InstitutionalShell, providers, rutas, sesión, permisos, lazy loading, logout y cambio obligatorio de contraseña. **20/20**.
* **E2E reproducible:** `test:e2e:mock` aprobó **19/19** sin secretos. `test:e2e:release` exige `E2E_RELEASE_PASSWORD` o `E2E_SEED_PASSWORD` y falla de forma explícita si faltan.
* **Gate legacy v2 comparable:** **190 → 177** violaciones sobre los mismos **409** archivos. El estricto ampliado aprobó con cero en Shell, Auth, Dashboard, Caja, Facturación, Catálogo, Administración, Recibos, Reportes y Contabilidad.
* **Build:** aprobado. Se eliminó el warning Lightning CSS de `@theme`; el vendor monolítico bajó de 2,763.67 kB a 177.11 kB al separar Ant Design (1,160.12 kB), AG Grid (873.95 kB) y ECharts (556.20 kB). Permanecen warnings >500 kB de esas tres bibliotecas, documentados y no silenciados.
* **Impresión física:** pendiente y declarada como deuda; la automatización no se presenta como certificación de impresora real.
* **Regresión Vitest segmentada final:** **145/145 archivos**, **1046 aprobados**, **0 fallidos**, **0 omitidos**, **12/12 segmentos**, 0 archivos no cubiertos, duplicados o sin reporte; 1751.0 s. Reporte agregado: `frontend/test-results/segmented-tests-summary.json`.
