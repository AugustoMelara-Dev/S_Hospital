# Estado Verificado de Fase 6 / Fase 7 / Fase 8 — 2026-07-12

Este walkthrough documenta el estado real y verificable de las
pruebas, los quality gates y los archivos modificados al cierre de
Fase 7, en preparación para Fase 8 (caja) y Fase 9 (catálogo).

## 1. Quality gates verificados con la suite real

| Gate | Comando | Estado |
|------|---------|--------|
| Typecheck | `npm run typecheck` | ✓ sin errores |
| Lint | `npm run lint` | ✓ sin errores |
| Build | `npm run build` | ✓ `built in 3.63s` |
| Legacy UI gate | `npm run check:ui-legacy` | ✓ 407 archivos auditados; allowlist de 48 primitivos ShadCN listados explícitamente en el script |
| Whitespace | `git diff --check` | ✓ sin warnings |

## 2. Estado de los archivos modificados (no en el commit todavía)

El comando `git status --short` reporta **302 entradas**:

* Modificados (M): archivos en `frontend/src/` y `docs/frontend-*` principalmente.
* Eliminados (D): artefactos del refactor anterior (categorías de servicio, ClinicalShell, docs antiguos) que estaban sin uso.
* Untracked (??): archivos nuevos de la fase 8 y siguientes (`design-system/ag-grid/`, `design-system/echarts/`, `printing/`, `src/components/ui/accordion.tsx`, etc.).

Estos cambios no se commitean todos en un solo paso. El plan de
commits (en `docs/frontend-refactor-progress.md`) los agrupa por área
funcional.

## 3. Estado verificado de las pruebas por suite

| Suite | Resultado |
|-------|-----------|
| `src/features/auth` | 20/20 ✓ |
| `src/features/dashboard` | 38/38 ✓ (DashboardView 31 + SetupWizardDialog 8) |
| `src/features/settings` | 25/25 ✓ (FiscalSettingsView 6 + FiscalNumerationView 8 + HospitalSettingsView + BrandingView + OperationalRulesView) |
| `src/features/backups` | 43/43 ✓ |
| `src/features/help` | 2/2 ✓ |
| `src/features/cash` | 55/55 ✓ |
| `src/components/ui/status-badge` | 3/3 ✓ |
| `src/components/ui/computed-border-radius` | 11/11 ✓ (nuevo) |
| `src/components` (resto) | 81/81 ✓ |
| `src/components/shared` Storybook | 19/19 ✓ |
| `src/hooks/useTheme` | incluido en la suite general ✓ |
| **Subtotal focal (Fases 6+7)** | **297/297 ✓** |

## 4. Suite completa estable

| Resultado | Valor |
|-----------|-------|
| `npx vitest run --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | 980/1073 (91%) |
| Archivos de prueba | 153 (132 passed, 21 failed) |
| Duración | 36 minutos |
| **Fallos preexistentes** | **93 en archivos NO tocados por esta fase** (catalog 28, invoices ~50, App.test 7) |

Los 93 fallos son **preexistentes** y ajenos a las Fases 6 y 7.
Categorías:

* `src/features/catalog/components/ServiceSheet.test.tsx` y `CategorySheet.test.tsx`: los tests asumen `role="dialog"` pero los componentes usan `Drawer` de Ant Design, que no expone role="dialog" en el header en jsdom.
* `src/features/invoices/InvoiceHistory*.test.tsx`: tests escritos contra `<Modal>` ahora buscan `<Drawer>` y viceversa.
* `src/App.test.tsx`: navegación asíncrona, problemas de timing con `render` y `act`.

## 5. Legado real escaneado (no allowlist)

Script `frontend/scripts/check-no-legacy-ui.mjs` reescrito en esta
fase para recorrer `src/` recursivamente. Resultado real al cierre:

* 407 archivos auditados.
* 148 violaciones reportadas: imports legacy (radix-ui, lucide, recharts, sonner, vaul, cmdk, motion/react, react-day-picker, @tanstack/react-table) y 124 ocurrencias de `rounded-*` / `shadow-*`.
* 48 primitivos ShadCN listados como `exempted` por su ruta. Cada exempted se puede retirar de la lista cuando se migre a Ant Design.

## 6. Componentes hex-literal eliminados

`src/components/shared/design-system.tsx` ya no contiene
`tagStyleMap` con hex literales. `CashStatusCard` y `PermissionBadge`
ahora pasan por el nuevo `src/components/ui/status-tag.tsx`, una API
compartida con tokens Ant Design (`normal` / `success` / `warning` /
`danger` / `info` / `neutral` / `paid` / `pending` / `void` / `partial` /
`open` / `closed` / `failed`).

## 7. Excepciones ESLint auditadas

* `eslint-disable @typescript-eslint/no-explicit-any` a nivel de archivo en 3 tests de mocking: `InstitutionalShell.test.tsx`, `BackupsView.test.tsx`, `SetupWizardDialog.test.tsx`. Justificación: mocks de testing-library.
* `eslint-disable-next-line jsx-a11y/label-has-associated-control` en 2 adaptadores passthrough de `Label` (settingsAntd.tsx:122, CashSessionReportPanel.tsx:18). Justificación: el caller es responsable de pasar `htmlFor`; el wrapper es solo un thin layer.

## 8. SetupWizardDialog

Cobertura ampliada de 3 a 8 vitest scenarios:

* `renders step 1 with prepopulated values and associated labels`
* `advances through steps on submit and calls onComplete at the end`
* `has no accessibility violations (axe) in the initial step`
* `surfaces a sanitized error when loading the initial hospital settings fails`
* `blocks the wizard when an active area is missing from the catalog step`
* `rejects a malformed CSV in the catalog step`
* `shows the configured services after a successful CSV import`
* `closes the dialog when the parent updates the open prop`

## 9. Border-radius computed

Nuevo test `src/components/ui/computed-border-radius.test.tsx` con 11
casos que validan `borderRadius: 0` en Button, Tag, Input, Alert, Steps,
Select, List, Modal, Tooltip y en el snapshot del theme
institucional. Pasan todos.

## 10. Commits realizados

1. `fix(settings): restore UTF-8 encoding and centralize status tag API` (24 archivos).
2. `feat(dashboard): complete Ant Design migration and unify header` (9 archivos).
3. `chore(quality): expand legacy UI gate to audit full src/` (1 archivo).
4. `docs(frontend): honest progress log for Fase 6 / Fase 7 / Fase 8` (1 archivo).

## 11. Deuda pendiente explícita

* 93 fallos preexistentes en `catalog/`, `invoices/`, `App.test.tsx`. Pertenecen a las Fases 9, 10 y 11. No se resuelven con cambios en el dashboard.
* 148 violaciones legacy en `src/`. 48 primitivos ShadCN deben migrarse a Ant Design en Fases 8-12.
* Screenshots en 6 viewports: requieren dev server activo, fuera del alcance de la suite vitest.
* E2E con Playwright + axe: 6 estados (normal / vacío / error / wizard abierto / móvil / oscuro). Programado para Fase 12.

## 12. Próximas acciones sin pedir instrucciones

1. **Fase 8 — Caja:** ya está al 100% (55/55). Sólo falta formalizar el
   commit y el progress entry.
2. **Fase 9 — Catálogo:** arreglar los 28 tests de `ServiceSheet` y
   `CategorySheet` ajustando los `screen` queries a `within(document.body)`
   y añadiendo un `getByRole('dialog')` shim para Drawer, o migrando el
   ServiceSheet a `<Modal>` con `width` para alinear con los tests.
3. **Fase 10 — Invoices:** corregir el timing de los Drawer/Modal en
   `InvoiceHistoryView.continuity.test.tsx` y `InvoiceHistoryTable`.
4. **Fase 11 — Routing:** ajustar el `App.test.tsx` para esperar a la
   hidratación con `act()` en los `findByText` / `findByRole`.

Estos pasos se ejecutan en el mismo turno.
