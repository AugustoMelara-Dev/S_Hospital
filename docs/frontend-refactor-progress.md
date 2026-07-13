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
