# Coordination Board - V1.2 Full UX/UI Redesign

Fecha: 2026-06-28
Base: `742fdb551b202ddb0473a0269440e0bf6ff116ce`
Rama principal: `codex/v1-2-full-ux-ui-redesign`
Checkpoint: `checkpoint/pre-v1-2-full-ux-ui-redesign-20260628-1758`

## Estado De Base

- `main` y `origin/main`: `742fdb551b202ddb0473a0269440e0bf6ff116ce`
- SHA conocido `d0f48aabcb8e3611808c5b8b130de12aafbc2f98`: ancestro de `origin/main`
- `origin/codex/v1-2-visible-ui-delta`: YA INTEGRADO, sin diff contra `origin/main`
- Checkout raiz `C:\Projects\S_Hospital`: sucio y no se toca
- Worktree activo de esta fase: `C:\Users\melar\.config\superpowers\worktrees\S_Hospital\codex-v1-2-full-ux-ui-redesign`

## Reglas De Coordinacion

- No tocar backend salvo necesidad visual justificada y con pruebas.
- No cambiar contratos: endpoints, payloads, query keys, permisos, callbacks, calculos, caja, PDF o reimpresion.
- No usar `git reset --hard`, `git clean`, `git restore .`, `rebase`, force push ni `git add -A`.
- Cada area debe reducir estilos manuales y componer componentes/tokens compartidos.
- Cada handoff debe listar archivos tocados, pruebas y riesgos.

## Subagentes

| ID | Rama | Worktree sugerido | Archivos permitidos | Archivos prohibidos | Objetivo | Pruebas | Handoff |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A. Design System & Tokens | `codex/v1-2-full-design-system` | `C:\Users\melar\.config\superpowers\worktrees\S_Hospital\codex-v1-2-full-design-system` | `frontend/src/styles.css`, `frontend/src/components/ui/**`, `frontend/src/components/shared/**`, `frontend/src/lib/utils.ts`, `docs/ux/**` | `backend/**`, `.env*` | Centralizar tokens y componentes base: PageShell, panels, badges, states, DataTable, receipt shell. | `pnpm run typecheck`, `pnpm run test -- data-table states` | Lista de tokens/componentes, antes/despues de estilos locales, riesgos. |
| B. Shell & Navigation | `codex/v1-2-full-shell` | `...\codex-v1-2-full-shell` | `frontend/src/layout/**`, `frontend/src/navigation/**`, `frontend/src/App*.tsx`, `frontend/src/routes.ts` | `backend/**`, APIs | AppShell institucional, nav desktop/mobile, active states, dark mode, access denied/404 shell. | `pnpm run test -- App AppShell`, smoke navigation | Rutas tocadas, permisos preservados, capturas. |
| C. Dashboard Command Center | `codex/v1-2-full-dashboard` | `...\codex-v1-2-full-dashboard` | `frontend/src/features/dashboard/**`, dashboard hooks read-only | `backend/**`, `frontend/src/lib/api/**` salvo tipos visuales | Dashboard como centro de mando con KPIs, caja/LAN, charts y alertas. | `pnpm run test -- DashboardView` | Componentes usados, query keys preservadas, capturas. |
| D. Billing/POS Experience | `codex/v1-2-full-billing-pos` | `...\codex-v1-2-full-billing-pos` | `frontend/src/features/invoices/NewInvoiceView*`, `frontend/src/features/invoices/components/**`, tests POS | `backend/**`, calculos dinero | Estacion de caja clara: paciente, busqueda, carrito, cobrar, sticky mobile. | `pnpm run test -- NewInvoiceView PaymentModal` | Contratos preservados, errores, mobile, capturas. |
| E. Reports & Analytics | `codex/v1-2-full-reports` | `...\codex-v1-2-full-reports` | `frontend/src/features/reports/**`, charts/tables compartidos | `backend/**`, report API contracts | Reportes ejecutivos con tabs, filtros, KPIs, charts y tablas robustas. | `pnpm run test -- ReportsView` | Filtros/payloads preservados, charts, tablas. |
| F. Data Tables Platform | `codex/v1-2-full-data-tables` | `...\codex-v1-2-full-data-tables` | `frontend/src/components/ui/data-table*`, table tests, wrappers | `backend/**` | Sorting/filtering/pagination/visibility reutilizable y accesible. | `pnpm run test -- data-table` | API del componente, migraciones necesarias, a11y. |
| G. Cashbox & Invoice History | `codex/v1-2-full-cash-history` | `...\codex-v1-2-full-cash-history` | `frontend/src/features/cash/**`, `frontend/src/features/invoices/InvoiceHistoryView*` | `backend/**`, pagos/caja logic | Caja y historial con estados, filtros, acciones y tablas robustas. | `pnpm run test -- CashboxView InvoiceHistoryView` | Permisos, acciones, no cambios de contrato. |
| H. Receipts / Print / Settings | `codex/v1-2-full-receipts-settings` | `...\codex-v1-2-full-receipts-settings` | `frontend/src/features/receipts/**`, `frontend/src/features/receipt-settings/**`, `frontend/src/features/settings/**`, receipt CSS | `backend/**` salvo prueba PDF justificada | Preview formal, paper frames, settings fiscal/recibos sin inventar legal. | `pnpm run test -- ReceiptPreview InstitutionalReceipt` | Print safe, formatos, sin QR/codigos internos. |
| I. Admin / Auth / Users / RBAC | `codex/v1-2-full-admin-auth` | `...\codex-v1-2-full-admin-auth` | `frontend/src/features/auth/**`, `frontend/src/features/admin/**`, permission components | `backend/**`, policies | Login, password change, usuarios, roles/permisos agrupados. | `pnpm run test -- LoginView UsersView` | Permisos preservados, errores, dark mode. |
| J. Catalog / Backups / Support | `codex/v1-2-full-ops-support` | `...\codex-v1-2-full-ops-support` | `frontend/src/features/catalog/**`, `frontend/src/features/backups/**`, `frontend/src/features/help/**`, `frontend/src/features/about/**`, `frontend/src/features/support/**` | `backend/**`, backup/restore logic | Catalogo, backups, help/about/soporte con estructura profesional. | `pnpm run test -- CatalogView BackupsView HelpView` | Acciones preservadas, empty/error states. |
| K. A11y / Responsive / Performance QA | `codex/v1-2-full-qa` | `...\codex-v1-2-full-qa` | `frontend/e2e/**`, `docs/qa/**`, `qa/v1-2-full-ux-ui-redesign/**` | Backend productivo | Axe, responsive, overflow, focus, dark mode, performance review. | Playwright specs requeridos, build | PASS/FAIL por pantalla, bugs P0/P1. |
| L. Integration Reviewer | `codex/v1-2-full-ux-ui-redesign-integration` | `...\codex-v1-2-full-integration` | Integracion y docs finales | Cambios funcionales no justificados | Revisar merges normales en orden y gates finales. | Full frontend gate | Informe final y recomendacion de merge. |

## Checklist Vivo

- [x] Fase 0: base verificada.
- [x] Fase 1: checkpoint remoto y rama principal actualizada.
- [x] Fase 2: investigacion oficial documentada.
- [x] Fase 3: decision de librerias documentada.
- [x] Fase 4: coordinacion inicial creada.
- [ ] Fase 5: capturas before.
- [ ] Fase 6: design system centralizado.
- [ ] Fase 7: rediseño de pantallas.
- [ ] Fase 8: verificacion de contratos.
- [ ] Fase 9: capturas after y delta review.
- [ ] Fase 10: a11y/responsive.
- [ ] Fase 11: performance.
- [ ] Fase 12: tests.
- [ ] Fase 13: integracion.
- [ ] Fase 14: informe final.
- [ ] Fase 15: commit y push final.
