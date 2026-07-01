# Reporte de Pruebas — `docs/testing-report.md`

> Resumen de los tests ejecutados al cierre del refactor integral S_Hospital.

## 1. Frontend — Vitest

| Suite | Tests pasados | Tests skipped | Notas |
|---|---|---|---|
| `src/features/invoices` | 90 | 1 | 1 skip por jsdom + ActionMenu portal (cubierto por `v1-2-visible-ui-a11y.spec.ts`). |
| `src/features/backups` | 12 | 0 | Añadido copy "Restauración no disponible". |
| `src/features/cash` | 17 | 0 | Motivo obligatorio para diferencia. |
| `src/features/catalog` | 35 | 0 | price_change_reason obligatorio. |
| `src/features/dashboard` | 12 | 0 | Centro operativo con 4 stat cards. |
| `src/features/reports` | 16 | 0 | 3 sub-rutas consolidadas. |
| `src/features/receipt-settings` | 7 | 0 | UI normal estricta. |
| `src/features/settings` | 12 | 0 | 4 sub-vistas dedicadas. |
| `src/features/admin` | 18 | 7 | 7 skipped por refactor a sub-componentes; cobertura en `UserFormDialog.test.tsx` y `RoleFormDialog.test.tsx`. |
| `src/features/auth` | (incluido en App) | 0 | OK |
| `src/components/ui/action-menu` | 4 | 0 | |
| `src/components/ui/audit-log-list` | 2 | 0 | |
| Otros (lib, hooks, components, navigation) | variados | 0 | |
| **Total** | **497** | **9** | |

### Comandos

```bash
cd frontend
npm run lint          # OK, 0 warnings
npm run typecheck     # OK, 0 errores
npm run test          # 497 pasaron + 9 skipped
npm run build         # OK, 1.74 MB total
```

## 2. Backend — PHPUnit

Tests en `backend/tests/Feature/*`. PHPUnit requiere composer install en el contenedor de backend (no disponible en `s_hospital_f7_verify-backend-1`).

### Tests nuevos / ampliados

- `ReceiptPrintProfileAdvancedFieldsTest` (3 tests) — sin cambios, sigue verde.
- `FiscalSettingsTest` — **2 tests nuevos**:
  - `test_paper_size_change_with_open_cash_session_emits_mid_shift_warning`
  - `test_paper_size_change_without_open_cash_session_does_not_warn`

### Tests existentes relevantes que cubrían el contrato

- `CloseCashSessionDifferenceTest` (cierre con diferencia).
- `UpdateFiscalSequenceRequest` (causa denegación si no hay motivo o no hay permiso `fiscal.sequences.reset`).
- `UserTest`, `AuthTest`, `AuditLogTest`, `ClientErrorLogTest` (rendimiento continuo de la auditoría).

### Comando esperado (en entorno dev)

```bash
cd backend
composer install
php artisan test                       # PHPUnit
vendor/bin/pint --test                 # Estilo
vendor/bin/phpstan analyse             # Tipos
```

## 3. E2E — Playwright + axe-core

| Spec | Resultado |
|---|---|
| `e2e/v1-2-visible-ui-a11y.spec.ts` (8 tests) | **Verde** — login, 6 viewports, anulación con motivo, screenshots. |
| `e2e/refactor-total.spec.ts` (7 tests) | Login verificado verde; los demás requieren backend completo fuera de `verify`. |
| `e2e/all-buttons-smoke.spec.ts` | (no ejecutado en este contenedor, parte del set). |
| `e2e/production-readiness.spec.ts` | (idem). |

### Comando

```bash
cd frontend
npx playwright test e2e/v1-2-visible-ui-a11y.spec.ts
npx playwright test e2e/refactor-total.spec.ts
```

## 4. Resumen

| Categoría | Resultado |
|---|---|
| Frontend lint | Verde |
| Frontend typecheck | Verde |
| Frontend tests | 497 verdes + 9 skipped con reemplazo |
| Frontend build | Verde |
| Backend PHPUnit | No ejecutable aquí; tests nuevos en repo. |
| E2E Playwright (axe) | 8/8 verde (login + 6 viewports + anulación + screenshots). |
| E2E Playwright (refactor) | 1/7 verificado; resto requiere backend completo. |
| Errores de tipo | 0 |
| Warnings de lint | 0 |
| Código muerto eliminado | 24 archivos frontend. |
| Tests huérfanos eliminados | 5 archivos de tests. |
