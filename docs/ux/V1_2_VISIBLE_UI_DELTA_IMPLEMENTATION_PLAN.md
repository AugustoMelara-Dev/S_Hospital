# V1.2 Visible UI Delta Implementation Plan

> Plan generado en modo plan antes de implementar cambios amplios. No autoriza tocar reglas de negocio.

Fecha: 2026-06-26

Rama principal: `codex/v1-2-visible-ui-delta`

Base real: `d0f48aabcb8e3611808c5b8b130de12aafbc2f98`

## 1. Resumen ejecutivo

V1.2 convertira la UI de S_Hospital en una version visualmente mas fuerte, institucional y clara, usando un design system centralizado sobre el stack actual: React, TypeScript, Tailwind CSS v4, Radix UI, Recharts, TanStack Query, React Hook Form y Zod.

El alcance es UX/UI. No se cambian calculos, impuestos, pagos, caja, numeracion fiscal, permisos, endpoints, payloads ni reportes backend. El resultado debe demostrar un delta visible en dashboard, POS, reportes, caja, historial, recibos/settings, catalogo, backups, usuarios/auth, shell y estados globales.

## 2. Suposiciones explicitas

- `origin/main` en `d0f48aabcb8e3611808c5b8b130de12aafbc2f98` es la base aprobada.
- El runtime correcto conocido para evidencia visual es `http://192.168.1.10:8081`.
- Produccion fisica aprobada sigue siendo NO.
- No se requiere migracion de base de datos para este refactor.
- No se agregan librerias nuevas al inicio. TanStack Table queda en evaluacion.
- Los datos visibles deben venir de contratos existentes o de estados vacios; no se inventan KPIs, textos fiscales ni datos legales.
- Los formatos principales de recibo son carta, media carta y A5; 80mm/58mm quedan secundarios.

## 3. Preguntas bloqueantes

No hay preguntas bloqueantes para iniciar documentacion, investigacion, checkpoint, rama, capturas before y design system.

Preguntas no bloqueantes:

- Si el hospital prefiere un tono visual mas "gobierno/institucional" o mas "operativo/caja moderna", se puede ajustar dentro del design system sin cambiar alcance.
- Si TanStack Table se aprueba, debe decidirse despues de una tabla piloto y no antes.

## 4. Arquitectura propuesta

La arquitectura visual se organiza en tres capas:

1. Tokens y primitivas: `frontend/src/styles.css`, `frontend/src/components/ui/**`.
2. Componentes de patron operativo: `frontend/src/components/shared/**`, `frontend/src/layout/**`, `frontend/src/navigation/**`.
3. Pantallas de dominio: dashboard, POS, reportes, caja, historial, recibos/settings, catalogo, backups, auth/users.

Cada pantalla debe consumir componentes compartidos. Los cambios por modulo deben ser revisables y commiteables sin mezclar backend, DB ni logica fiscal.

## 5. Modelo de datos y migraciones

Migraciones esperadas: ninguna.

Razon: V1.2 es un refactor UX/UI. Los datos se leen de APIs existentes y snapshots existentes. Si una fase descubre una necesidad real de backend, se debe detener esa subfase, documentar riesgo y crear plan separado.

## 6. Modulos y fases

### Fase 0 - Verificacion inicial

Alcance: fetch, estado git, SHAs, ancestria y log.

Archivos esperados: ninguno.

Migraciones: ninguna.

Pruebas: comandos git solicitados.

Riesgos: trabajar sobre base incorrecta.

Criterio de aceptacion: `main` limpio, `main == origin/main`, SHA aprobado ancestro de `origin/main`.

Estado: completado.

### Fase 1 - Checkpoint y rama principal

Alcance: crear checkpoint remoto y rama `codex/v1-2-visible-ui-delta`.

Archivos esperados: ninguno.

Migraciones: ninguna.

Pruebas: push remoto exitoso.

Riesgos: crear ramas desde base equivocada.

Criterio de aceptacion: checkpoint y rama publicados.

Estado: completado.

### Fase 2 - Investigacion oficial

Alcance: documentar referencias oficiales de shadcn/ui, Tailwind v4, Radix UI, Recharts, TanStack Table y WCAG/WAI.

Archivos:

- `docs/ux/V1_2_RESEARCH_REFERENCES.md`

Migraciones: ninguna.

Pruebas: revision documental.

Riesgos: adoptar patrones incompatibles con offline/LAN o accesibilidad.

Criterio de aceptacion: cada fuente tiene conclusion, decision, riesgo y libreria afectada.

Estado: completado.

### Fase 3 - Decision de librerias

Alcance: evaluar librerias actuales y nuevas.

Archivos:

- `docs/ux/V1_2_LIBRARY_DECISION_RECORD.md`

Migraciones: ninguna.

Pruebas: validar `frontend/package.json`.

Riesgos: bundle innecesario, librerias duplicadas, dependencia runtime online.

Criterio de aceptacion: librerias agregadas/rechazadas documentadas.

Estado: completado.

### Fase 4 - Coordinacion de subagentes y worktrees

Alcance: tablero con ramas, worktrees, permisos, prohibiciones y handoff.

Archivos:

- `docs/ux/v1-2-subagents/COORDINATION_BOARD.md`

Migraciones: ninguna.

Pruebas: revision de rutas permitidas/prohibidas.

Riesgos: conflictos entre agentes, cambios de dominio accidental.

Criterio de aceptacion: 10 subagentes definidos y orden de integracion claro.

Estado: completado a nivel documental; worktrees pendientes.

### Fase 5 - Design system centralizado

Alcance: tokens, superficies, sombras, radios, spacing, chart colors, receipt border y componentes compartidos.

Archivos esperados:

- `frontend/src/styles.css`
- `frontend/src/components/ui/**`
- `frontend/src/components/shared/**`
- `frontend/src/layout/**`
- `frontend/src/navigation/**`
- `frontend/src/lib/utils.ts`
- `docs/ux/V1_2_DESIGN_SYSTEM.md`

Migraciones: ninguna.

Pruebas:

- `npm run typecheck`
- `npm run lint`
- `npm run test -- ui`
- `npm run build`

Riesgos: romper dark mode, print, foco o componentes existentes.

Criterio de aceptacion: componentes compartidos cubren los patrones listados y reducen estilos sueltos.

### Fase 6 - Shell y navegacion

Alcance: sidebar, topbar, breadcrumbs, LAN/caja/usuario/rol, quick actions, mobile nav y permisos.

Archivos esperados:

- `frontend/src/layout/**`
- `frontend/src/navigation/**`
- tests AppShell/PermissionGate

Migraciones: ninguna.

Pruebas: AppShell, mobile nav, a11y focal.

Riesgos: mostrar rutas sin permiso o ocultar acciones criticas.

Criterio de aceptacion: shell se siente profesional y usable en desktop/tablet/mobile.

### Fase 7 - Dashboard command center

Alcance: banda institucional, estado operativo/caja, acciones primarias, resumen del dia/mes, ingresos, facturas, pagos, pendientes, servicios top, metodos de pago y estados vacios.

Archivos esperados:

- `frontend/src/features/dashboard/**`
- chart wrappers compartidos si aplica

Migraciones: ninguna.

Pruebas: Dashboard tests, screenshots 1366x768, 1920x1080, tablet, mobile.

Riesgos: inventar KPIs o degradar charts.

Criterio de aceptacion: delta visible fuerte sin datos inventados.

### Fase 8 - Billing/POS 10/10

Alcance: buscador dominante, paciente claro, categorias/resultados jerarquizados, carrito/panel de caja, total grande, cobrar claro, caja cerrada, sticky summary, error/empty states, keyboard hints y mobile.

Archivos esperados:

- `frontend/src/features/invoices/**`
- tests NewInvoiceView, PaymentModal, InvoiceConfirmation

Migraciones: ninguna.

Pruebas: componentes POS y E2E release focal.

Riesgos: tocar reducer, payload, idempotencia o calculos.

Criterio de aceptacion: POS parece estacion de caja profesional y no cambia contratos.

### Fase 9 - Reportes y analytics

Alcance: executive header, filtros, KPI cards, charts, legends, tooltips, tabs, tablas, empty states, export actions.

Archivos esperados:

- `frontend/src/features/reports/**`
- wrappers de charts/tablas si aplica

Migraciones: ninguna.

Pruebas: ReportsView, Tabs, Charts, Tables, a11y, mobile screenshots.

Riesgos: filtrado cliente falso, charts inaccesibles, datos inventados.

Criterio de aceptacion: reportes impresionan sin cambiar backend.

### Fase 10 - Cashbox e historial

Alcance: caja abierta/cerrada, esperado/contado/diferencia, movimientos, resumen por metodo, cierre, alertas, historial, filtros, detalle, PDF/reimpresion y anulacion UI.

Archivos esperados:

- `frontend/src/features/cashbox/**`
- `frontend/src/features/invoices/**`

Migraciones: ninguna.

Pruebas: Cashbox, InvoiceHistory, dialogs, permissions UI.

Riesgos: suavizar acciones sensibles o cambiar autorizacion.

Criterio de aceptacion: caja e historial son mas claros y seguros.

### Fase 11 - Recibos/settings/catalogo/backups

Alcance: preview fuerte, frame documento, selector formato, settings entendibles, catalogo, backups, estados y advertencias.

Archivos esperados:

- `frontend/src/features/receipt-settings/**`
- `frontend/src/features/settings/**`
- `frontend/src/features/catalog/**`
- `frontend/src/features/backups/**`

Migraciones: ninguna.

Pruebas: receipt settings, catalog, backups, fiscal settings.

Riesgos: inventar datos legales o tocar restore/backup productivo.

Criterio de aceptacion: pantallas operativas se sienten formales y seguras.

### Fase 12 - Auth/users/RBAC UI

Alcance: login institucional, estado LAN, version, errores claros, usuarios, roles, permisos agrupados y access denied.

Archivos esperados:

- `frontend/src/features/auth/**`
- `frontend/src/features/users/**`
- access denied/404 si aplica

Migraciones: ninguna.

Pruebas: Login, UsersView, RBAC E2E focal, a11y dialogs.

Riesgos: debilitar RBAC o exponer detalles internos.

Criterio de aceptacion: auth/users claros sin cambiar permisos backend.

### Fase 13 - Before/after screenshots

Alcance: capturas antes y despues de pantallas minimas.

Archivos esperados:

- `qa/v1-2-visible-ui-delta/before/**`
- `qa/v1-2-visible-ui-delta/after/**`
- `docs/qa/V1_2_VISUAL_DELTA_REVIEW.md`

Migraciones: ninguna.

Pruebas: Playwright screenshots y revision visual.

Riesgos: evidencia contra runtime equivocado.

Criterio de aceptacion: delta visible evidente o bloqueo por UX.

### Fase 14 - A11y, responsive y performance

Alcance: matriz de viewports, axe, overflow, foco, controles nombrados, h1, dialogs, tablas, dark mode y performance.

Archivos esperados:

- `frontend/e2e/v1-2-visible-ui-a11y.spec.ts`
- `docs/qa/V1_2_PERFORMANCE_REVIEW.md`

Migraciones: ninguna.

Pruebas: Playwright a11y/responsive, bundle/build.

Riesgos: cambios bonitos con regresiones de accesibilidad.

Criterio de aceptacion: axe critical/serious 0 y build pass.

### Fase 15 - Integracion

Alcance: rama `codex/v1-2-visible-ui-delta-integration`, merges normales, conflictos manuales, gates por merge.

Archivos esperados:

- reportes de integracion en `docs/qa/**`

Migraciones: ninguna.

Pruebas: typecheck/lint/test focal tras cada merge.

Riesgos: conflictos visuales, duplicacion de componentes.

Criterio de aceptacion: integracion secuencial sin rebase ni force push.

### Fase 16 - Gates finales

Alcance: quality gates frontend y E2E. Backend solo si se toca.

Comandos:

- `npm ci`
- `npm audit`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run smoke:buttons`
- `npx playwright test e2e/v1-2-visible-ui-a11y.spec.ts`
- `npx playwright test e2e/production-readiness.spec.ts`
- `npm run test:e2e`

Riesgos: entorno local sin runtime o dependencias.

Criterio de aceptacion: gates reportados con PASS/FAIL reales.

### Fase 17 - Informe final

Alcance: reporte final con base, ramas, librerias, resultados por modulo, before/after, a11y, performance, tests y recomendacion.

Archivos:

- `docs/qa/V1_2_VISIBLE_UI_DELTA_FINAL_REPORT.md`

Migraciones: ninguna.

Pruebas: revision de consistencia.

Criterio de aceptacion: reporte contiene los 28 puntos solicitados.

### Fase 18 - Criterio final

Alcance: decidir LISTO PARA REVISION, BLOQUEADO POR UX, BLOQUEADO POR TESTS o BLOQUEADO POR SEGURIDAD.

Criterio de aceptacion: si dashboard/POS/reportes/caja no tienen delta visible, estado `BLOQUEADO POR UX - DELTA INSUFICIENTE`.

### Fase 19 - Commit y push

Alcance: commits separados por area y push final.

Commits esperados:

- `docs(ux): record v1.2 research and coordination plan`
- `feat(ui): centralize v1.2 operational design system`
- `feat(shell): refresh hospital navigation shell`
- `feat(dashboard): add operational command center`
- `feat(billing): refresh cashier pos experience`
- `feat(reports): refresh analytics workspace`
- `feat(cashbox): refresh cashbox and invoice history`
- `feat(settings): refresh receipts catalog backups and settings`
- `feat(auth): refresh auth users and rbac ui`
- `test(qa): add v1.2 visual accessibility evidence`
- `docs(qa): add v1.2 final handoff report`

Riesgos: commits demasiado grandes.

Criterio de aceptacion: `git status` limpio y ramas pushadas.

## 7. Plan de TDD/pruebas por fase

- Design system: tests de primitives, estados y a11y existentes.
- Shell: AppShell, PermissionGate, mobile nav.
- Dashboard: tests de render con datos reales/mock y estados vacios.
- POS: NewInvoiceView, PaymentModal, Confirmation, double submit guard intacto.
- Reportes: tabs, filtros, charts, tablas y estados.
- Caja/historial: dialogs, filtros, acciones sensibles y permisos visuales.
- Settings/catalog/backups: forms, empty/error/loading, acciones sensibles.
- Auth/users: login errors, RBAC UI, permisos agrupados.
- QA final: Playwright a11y/responsive matrix, production-readiness, release E2E.

## 8. Plan de commits

Cada fase o subfase produce un commit convencional. No se mezcla frontend, backend, DB y docs salvo cuando la fase lo justifique. No usar `git add -A`; stage explicito por archivo.

## 9. Riesgos tecnicos y mitigaciones

| Riesgo | Mitigacion |
| --- | --- |
| Delta visual insuficiente | Capturas before/after y decision de bloqueo por UX. |
| Ruptura de contratos de negocio | Prohibir backend/API/reducers/payloads en subagentes de UI. |
| Dark mode o print rotos | Tests y screenshots por modo y review de print/receipt. |
| A11y degradada | Playwright + axe + revision manual focal. |
| Bundle inflado | No agregar librerias salvo decision documentada. |
| Conflictos por trabajo paralelo | Worktrees, ramas, archivos permitidos y orden de integracion. |
| Datos inventados | Usar estados vacios y datos existentes; registrar fuentes de cada KPI. |
| Runtime equivocado | Documentar URL y entorno en evidencia. |

## 10. Criterios de aceptacion por fase

Cada fase debe cumplir:

- alcance implementado,
- pruebas minimas ejecutadas o bloqueo documentado,
- cambios dentro de archivos permitidos,
- sin cambios de negocio,
- docs/decisiones actualizadas si aplica,
- commit convencional.

## 11. Comandos de verificacion

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

Si backend/PDF se toca:

```powershell
cd backend
php artisan test --colors=never
php artisan test --filter=InstitutionalReceiptPdfTest --colors=never
```

## 12. Lista de archivos esperados por fase

- Fase 2: `docs/ux/V1_2_RESEARCH_REFERENCES.md`
- Fase 3: `docs/ux/V1_2_LIBRARY_DECISION_RECORD.md`
- Fase 4: `docs/ux/v1-2-subagents/COORDINATION_BOARD.md`
- Fase 5: `frontend/src/styles.css`, `frontend/src/components/ui/**`, `frontend/src/components/shared/**`, `docs/ux/V1_2_DESIGN_SYSTEM.md`
- Fase 6: `frontend/src/layout/**`, `frontend/src/navigation/**`
- Fase 7: `frontend/src/features/dashboard/**`
- Fase 8: `frontend/src/features/invoices/**`
- Fase 9: `frontend/src/features/reports/**`
- Fase 10: `frontend/src/features/cashbox/**`, `frontend/src/features/invoices/**`
- Fase 11: `frontend/src/features/receipt-settings/**`, `frontend/src/features/settings/**`, `frontend/src/features/catalog/**`, `frontend/src/features/backups/**`
- Fase 12: `frontend/src/features/auth/**`, `frontend/src/features/users/**`
- Fase 13: `qa/v1-2-visible-ui-delta/**`, `docs/qa/V1_2_VISUAL_DELTA_REVIEW.md`
- Fase 14: `frontend/e2e/v1-2-visible-ui-a11y.spec.ts`, `docs/qa/V1_2_PERFORMANCE_REVIEW.md`
- Fase 17: `docs/qa/V1_2_VISIBLE_UI_DELTA_FINAL_REPORT.md`
