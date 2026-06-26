# V1.2 Subagents Coordination Board

Fecha: 2026-06-26

Rama principal: `codex/v1-2-visible-ui-delta`

Base real: `d0f48aabcb8e3611808c5b8b130de12aafbc2f98`

Checkpoint remoto: `checkpoint/pre-v1-2-visible-ui-delta-20260626-0711`

## Reglas globales

- Ningun subagente trabaja sobre `main`.
- Ningun subagente usa rebase, force push, reset hard, clean, restore masivo, `git add -A`, `test.skip`, `.only`, `@ts-ignore` ni `@ts-nocheck`.
- Ningun subagente cambia reglas de negocio, calculos, impuestos, pagos, caja, numeracion fiscal, permisos, endpoints, payloads, reportes backend, backup/restore productivo ni logica PDF backend salvo tarea explicitamente autorizada y probada.
- Cada subagente debe partir de `origin/codex/v1-2-visible-ui-delta` o de la rama integradora despues de incorporar design system.
- Cada subagente debe entregar reporte con archivos cambiados, pruebas ejecutadas, screenshots si aplica, riesgos y handoff.
- Si hay conflicto de archivos, gana el orden de integracion documentado: design system, shell, dashboard, billing/POS, reports, cash/history, ops/settings, auth/users, a11y/qa.
- La validacion final ocurre en rama integradora `codex/v1-2-visible-ui-delta-integration`.

## Rutas prohibidas salvo autorizacion expresa

- `backend/**`
- `database/migrations/**`
- `database/seeders/**`
- `routes/**`
- `.env`, `.env.*` con secretos o env real
- scripts destructivos o de produccion
- cualquier archivo que altere contratos API o reglas fiscales

## Subagentes

| ID | Subagente | Rama | Worktree sugerido | Archivos permitidos | Archivos prohibidos | Objetivo | Pruebas minimas | Handoff |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | DESIGN SYSTEM | `codex/v1-2-design-system` | `C:\Projects\S_Hospital-v12-design-system` | `frontend/src/styles.css`, `frontend/src/components/ui/**`, `frontend/src/components/shared/**`, `frontend/src/lib/utils.ts`, `docs/ux/**` | features de dominio salvo fixtures/tests focales | Crear tokens, superficies, componentes compartidos y doc `V1_2_DESIGN_SYSTEM.md`. | `npm run typecheck`, `npm run lint`, `npm run test -- ui`, `npm run build` si viable | Lista de componentes, tokens, cambios visuales y screenshots de primitives si aplica. |
| B | SHELL & NAVIGATION | `codex/v1-2-shell-navigation` | `C:\Projects\S_Hospital-v12-shell` | `frontend/src/layout/**`, `frontend/src/navigation/**`, `frontend/src/app/**`, tests de shell | dominio POS/reportes/caja salvo datos de nav | Mejorar sidebar, topbar, breadcrumbs, estado LAN, estado caja, quick actions y mobile nav. | Tests AppShell/PermissionGate/mobile nav, typecheck/lint | Handoff de rutas, permisos y screenshots desktop/mobile. |
| C | DASHBOARD COMMAND CENTER | `codex/v1-2-dashboard` | `C:\Projects\S_Hospital-v12-dashboard` | `frontend/src/features/dashboard/**`, wrappers charts compartidos acordados | API contracts, backend reports | Convertir dashboard en centro operativo con datos reales existentes y estados vacios. | Dashboard tests, chart tests, screenshot 1366/1920/mobile | KPIs usados, datos no inventados, before/after. |
| D | BILLING / POS | `codex/v1-2-billing-pos` | `C:\Projects\S_Hospital-v12-billing-pos` | `frontend/src/features/invoices/**`, `frontend/src/features/billing/**` si existe, tests POS | reducers/calculos/payloads/backend | Mejorar POS: buscador, paciente, categorias, carrito, total, caja cerrada, cobro, mobile. | NewInvoiceView, Cart, PaymentModal, Confirmation, release E2E focal | Confirmar "sin cambios de calculo/payload". |
| E | REPORTS & ANALYTICS | `codex/v1-2-reports` | `C:\Projects\S_Hospital-v12-reports` | `frontend/src/features/reports/**`, chart wrappers aprobados | backend report queries | Mejorar reportes con header ejecutivo, filtros, cards, charts, legends, tooltips, tablas y tabs. | ReportsView, chart tests, a11y reports, mobile screenshots | Si propone TanStack Table, decision record y tabla piloto. |
| F | CASHBOX & INVOICE HISTORY | `codex/v1-2-cash-history` | `C:\Projects\S_Hospital-v12-cash-history` | `frontend/src/features/cashbox/**`, `frontend/src/features/invoices/history/**`, tests relacionados | pagos backend, anulacion backend, permisos backend | Mejorar caja, cierre, movimientos, historial, filtros, detalle, cobro pendiente, PDF/reimpresion, anular UI. | Cashbox tests, InvoiceHistory tests, dialogs a11y | Confirmar que no cambia reglas de caja/anulacion. |
| G | RECEIPTS / SETTINGS / CATALOG / BACKUPS | `codex/v1-2-ops-settings` | `C:\Projects\S_Hospital-v12-ops-settings` | `frontend/src/features/receipt-settings/**`, `settings/**`, `catalog/**`, `backups/**`, docs UX | PDF backend salvo autorizacion, backup scripts | Mejorar preview, selector formato, catalogo, backups, fiscal/settings sin inventar datos legales. | Receipt settings, Catalog, Backups, Settings tests | Indicar campos opcionales preservados como null/vacio. |
| H | AUTH / USERS / RBAC UI | `codex/v1-2-auth-users` | `C:\Projects\S_Hospital-v12-auth-users` | `frontend/src/features/auth/**`, `frontend/src/features/users/**`, permission UI tests | backend RBAC/policies | Login institucional, estado LAN, usuarios, roles, permisos agrupados, access denied. | Login, UsersView, RBAC E2E focal, a11y dialogs | Confirmar que no expone contrasenas ni debilita RBAC. |
| I | ACCESSIBILITY / RESPONSIVE / QA | `codex/v1-2-a11y-qa` | `C:\Projects\S_Hospital-v12-a11y-qa` | `frontend/e2e/**`, `qa/v1-2-visible-ui-delta/**`, `docs/qa/**`, tests QA | cambios funcionales de dominio salvo fixes a11y pequenos coordinados | Crear matriz a11y/responsive, screenshots before/after y performance review. | `v1-2-visible-ui-a11y.spec.ts`, smoke buttons, build, e2e focales | Reporte `V1_2_VISUAL_DELTA_REVIEW.md` y `V1_2_PERFORMANCE_REVIEW.md`. |
| J | INTEGRATION REVIEW | `codex/v1-2-integration-review` | `C:\Projects\S_Hospital-v12-integration-review` | docs QA, review reports, integration notes | cambios productivos amplios | Revisar integracion secuencial, conflictos, regresiones visuales, a11y y contratos. | Diff review, typecheck/lint/test/build/e2e segun disponibilidad | Dictamen antes de push final. |

## Orden de integracion

1. `codex/v1-2-design-system`
2. `codex/v1-2-shell-navigation`
3. `codex/v1-2-dashboard`
4. `codex/v1-2-billing-pos`
5. `codex/v1-2-reports`
6. `codex/v1-2-cash-history`
7. `codex/v1-2-ops-settings`
8. `codex/v1-2-auth-users`
9. `codex/v1-2-a11y-qa`
10. `codex/v1-2-integration-review`

## Quality gate por merge

Despues de cada merge normal en la rama integradora:

```powershell
cd frontend
npm run typecheck
npm run lint
npm run test -- --run
```

Si el merge toca pantallas criticas:

```powershell
cd frontend
npm run test:critical
npm run build
```

Antes del push final:

```powershell
cd frontend
npm ci
npm audit
npm run typecheck
npm run lint
npm run test
npm run build
npm run smoke:buttons
npx playwright test e2e/v1-2-visible-ui-a11y.spec.ts
npx playwright test e2e/production-readiness.spec.ts
npm run test:e2e
```

Backend solo se ejecuta completo si se toca backend/PDF:

```powershell
cd backend
php artisan test --colors=never
php artisan test --filter=InstitutionalReceiptPdfTest --colors=never
```

## Estado inicial

- [x] Fase 0 verificada.
- [x] Checkpoint remoto creado.
- [x] Rama principal creada y publicada.
- [x] Investigacion oficial registrada.
- [x] Decision inicial de librerias registrada.
- [ ] Plan V1.2 aprobado.
- [ ] Subagentes despachados.
- [ ] Worktrees creados.
- [ ] Before screenshots capturados.
- [x] Design system integrado.
- [ ] Ramas de modulo integradas.
- [ ] A11y/responsive/performance gates ejecutados.
- [ ] Push final ejecutado.

## Registro de integracion

### 2026-06-26 - Design system

- Rama integrada: `codex/v1-2-design-system`
- Commits: `fc29d87e` y `214907a3`
- Merge en rama principal: `merge: integrate v1.2 design system`
- Archivos principales: `frontend/src/styles.css`, `frontend/src/components/shared/**`, `docs/ux/V1_2_DESIGN_SYSTEM.md`
- Revisiones: spec compliance APPROVED; code quality requirio fix de print/dark y re-review APPROVED.
- Gates ejecutados en rama principal:
  - `npm run typecheck` PASS
  - `npm run lint` PASS
  - `npm run test -- ui shared` PASS, 9 files / 42 tests
  - `npm run build` PASS
  - `git diff --check HEAD~1..HEAD` PASS

### 2026-06-26 - Shell y navegacion

- Rama de trabajo: `codex/v1-2-shell-navigation`
- Worktree: `C:\Projects\S_Hospital-v12-shell`
- Archivos principales: `frontend/src/layout/**`, tests `AppShell`, tablero de coordinacion.
- Handoff: shell institucional actualizado con sidebar mas fuerte, estado LAN/caja mas prominente, active state reforzado, breadcrumbs desktop mas visibles y drawer movil pulido.
- Guardrails confirmados: sin cambios en `appNavigation.ts`, rutas, orden, permisos, modes, backend, contratos API, POS, pagos o reportes.
- Gates ejecutados en rama de shell:
  - `npm run typecheck` PASS
  - `npm run lint` PASS
  - `npm run test -- AppShell appNavigation --run` PASS, 3 files / 16 tests
  - `npm run build` PASS

### 2026-06-26 - Dashboard command center

- Rama de trabajo: `codex/v1-2-dashboard`
- Worktree: `C:\Projects\S_Hospital-v12-dashboard`
- Archivos principales: `frontend/src/features/dashboard/**`, test `DashboardView`.
- Handoff: dashboard convertido en centro de mando operativo con banner institucional, estado de caja, acciones primarias, resumen de hoy/mes, pendiente mensual opcional, cards de ingresos, metodos de pago, servicios top, cajeros y next step.
- Datos usados: `cashSession`, `setupStatus` existente, `DashboardReport.current_month`, `DashboardReport.last_7_days`, `payments_by_method`, `top_services` y `cashiers_summary`. No se agregaron endpoints, queries, contratos ni KPIs fuera de esos campos.
- Guardrails confirmados: sin cambios backend, sin pagos/caja/reducers POS, sin payloads, sin calculos fiscales, sin permisos backend y sin librerias nuevas.
- Charts: `RevenueBarChart` y `PaymentMethodPieChart` dejan de apagar `accessibilityLayer`; mantienen tablas `sr-only`, leyendas y tooltips con tokens V1.2.
- Gates ejecutados en rama de dashboard:
  - `npm run test -- DashboardView --run` PASS, 1 file / 18 tests
  - `npm run lint` PASS
  - `npm run typecheck` PASS
  - `npm run build` PASS
  - `git diff --check` PASS
