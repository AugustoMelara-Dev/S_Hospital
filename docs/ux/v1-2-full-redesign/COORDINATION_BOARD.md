# V1.2 Full Redesign Coordination Board

Fecha: 2026-06-28

Rama principal: `codex/v1-2-full-ux-ui-redesign`

Base elegida: `origin/codex/v1-2-visible-ui-delta`

Clasificacion de `origin/codex/v1-2-visible-ui-delta`: UTIL COMO BASE. Contiene refactor visual amplio previo con design system, shell, dashboard, POS, reportes, cash/history, auth/users, settings, capturas y QA.

Checkpoint remoto: `checkpoint/pre-v1-2-full-ux-ui-redesign-20260628-0145`

Worktree principal: `C:\Users\melar\.config\superpowers\worktrees\S_Hospital\codex-v1-2-full-ux-ui-redesign`

## Reglas de coordinacion

- No tocar `main`.
- No usar rebase, force push, reset hard, clean, restore global ni checkout destructivo.
- No tocar backend salvo necesidad visual justificada y con pruebas.
- No cambiar endpoints, payloads, query keys, calculos, permisos, caja, facturacion, PDF ni reglas fiscales.
- Cada subagente debe tener ownership claro y no revertir trabajo ajeno.
- Las pantallas deben componer design system centralizado.

## Subagentes

| Subagente | Rama sugerida | Archivos permitidos | Archivos prohibidos | Objetivo | Pruebas |
| --- | --- | --- | --- | --- | --- |
| A. Design System & Tokens | `codex/v1-2-full-design-system` | `frontend/src/styles.css`, `frontend/src/components/ui/**`, `frontend/src/components/shared/**`, `docs/ux/**` | `backend/**`, migraciones, API contracts | Completar tokens y componentes centrales. | UI/component tests, typecheck/lint. |
| B. Shell & Navigation | `codex/v1-2-full-shell` | `frontend/src/layout/**`, `frontend/src/navigation/**`, `frontend/src/App.tsx` | Backend, features de negocio | AppShell institucional, responsive, dark mode. | AppShell tests, screenshots. |
| C. Dashboard Command Center | `codex/v1-2-full-dashboard` | `frontend/src/features/dashboard/**` | API/backend | Dashboard centro de mando. | Dashboard tests, screenshot. |
| D. Billing/POS Experience | `codex/v1-2-full-billing-pos` | `frontend/src/features/invoices/components/**` | Calculos/backend | Estacion de caja premium. | POS/payment tests. |
| E. Reports & Analytics | `codex/v1-2-full-reports` | `frontend/src/features/reports/**` | Report endpoints/backend | Analytics ejecutivo. | Reports tests. |
| F. Data Tables Platform | `codex/v1-2-full-data-tables` | `frontend/src/components/ui/data-table.tsx`, table consumers | Backend/API client | TanStack Table wrapper. | DataTable tests. |
| G. Cashbox & Invoice History | `codex/v1-2-full-cash-history` | `frontend/src/features/cash/**`, `frontend/src/features/invoices/history/**` | Cash math/backend | Caja e historial. | Cash/history tests. |
| H. Receipts / Print / Settings | `codex/v1-2-full-receipts-settings` | `frontend/src/features/receipt-settings/**`, print CSS | PDF backend salvo necesidad probada | Preview formal. | Receipt tests. |
| I. Admin / Auth / Users / RBAC | `codex/v1-2-full-admin-auth` | `frontend/src/features/admin/**`, `frontend/src/features/auth/**` | Policies/backend | Login, usuarios y permisos. | Users/Login tests. |
| J. Catalog / Backups / Support | `codex/v1-2-full-ops-support` | `frontend/src/features/catalog/**`, `frontend/src/features/backups/**`, help/about/support | Backup backend | Operaciones admin claras. | Catalog/backups tests. |
| K. A11y / Responsive / Performance QA | `codex/v1-2-full-qa` | `frontend/e2e/**`, `qa/**`, `docs/qa/**` | Product code salvo hooks coordinados | Axe, viewport matrix, performance. | `v1-2-full-a11y.spec.ts`. |
| L. Integration Reviewer | `codex/v1-2-full-integration-review` | docs/diffs | Backend/contracts | Revisar delta visual y contratos. | Review checklist. |

## Subagentes reales iniciados

- A / Design System & Tokens: explorer `019f0d33-f0dc-7b91-ad04-f178769c5a22`
- F / Data Tables Platform: explorer `019f0d34-2032-77e0-bc8c-f26d4f3667e0`
- K / A11y Responsive Performance QA: explorer `019f0d34-79a1-7382-9e65-e047183d3796`
- L / Integration Reviewer surface inventory: explorer `019f0d34-4d84-7303-b9e7-36d7d5c911a5`

## Auditoria adicional 2026-06-28

- Design System & Data Tables: explorer `019f10af-8987-7640-942e-4f17d85f123c`.
- Shell / Dashboard / POS: explorer `019f10af-a84e-7141-9b7b-8c9b86f209ab`.
- Reports / Cash / History / Receipts / Admin / Ops: explorer `019f10b0-1c51-76a2-96b4-ca516e0f52f8`.
- A11y / Responsive / Performance QA: explorer `019f10b0-534d-79e3-af52-ee0dfef6a534`.

Acciones tomadas desde esa auditoria:

- `DataTable` reforzado con sorting, filtro, paginacion y visibilidad de columnas opt-in.
- `PermissionBadge` implementado.
- Clases `status-success`, `status-warning`, `status-info` y `cash-layout` definidas.
- Historial de facturas ajustado para que acciones autorizadas no se recorten ni se oculten por configuracion de columnas.

## QA evidence refresh 2026-06-29

- `production-readiness.spec.ts` ahora captura Soporte (`support-light.png`) y mockea `/api/system/status-summary`.
- `production-readiness.spec.ts` ahora captura cambio obligatorio de contrasena (`password-change-required-light.png`, `password-change-required-dark.png`) usando un usuario mock con `must_change_password: true`.
- Las capturas de dialogs/modales usan viewport screenshot para estabilizar Radix Dialog/Select durante evidencia visual.
- Gates verificados: `pnpm run typecheck`, `pnpm run lint`, `pnpm run smoke:buttons`, `pnpm exec playwright test e2e/v1-2-full-a11y.spec.ts --config=playwright.config.ts` y `E2E_CAPTURE_RC_SCREENSHOTS=1 pnpm exec playwright test e2e/production-readiness.spec.ts --config=playwright.config.ts`.
- `pnpm run test:e2e` inicialmente fallo por 401 repetidos despues de login; causa corregida en `App` al no consultar caja protegida antes de autenticar usuario.
- `release-gate.spec.ts` espera respuestas reales de pago/PDF institucional para no correr contra el flujo asincrono de recibo.
- Verificacion posterior: `pnpm run test:e2e` PASS, 2 release tests; `pnpm exec playwright test e2e/production-readiness.spec.ts --config=playwright.config.ts` PASS, 4 tests.
