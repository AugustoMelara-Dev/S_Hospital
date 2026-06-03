# F6 — Frontend: hook useBackups con polling derivado

**Fecha:** 2026-06-01
**Fase del plan:** 6 de 12
**Rama:** `codex/audit-f1-config-hardening`
**Commit:** `69d0d29d refactor(frontend): harden useBackups hook with polling helper`

## Hallazgo abordado

- **HIGH** (auditoría) — `BackupsView.tsx` re-implementaba polling con `setTimeout(loadBackups, 5000)` cuando había un backup pendiente. Esto es trabajo manual que TanStack Query ya hace. F6 aprovecha el hook `useBackups` existente y lo mejora.

## Cambios

- `frontend/src/hooks/useBackups.ts`:
  - `BackupsFilters` exportado con type safety completo
  - `keepPreviousData` para que la paginación no haga flicker
  - `staleTime: 30_000` (antes sin stale time explícito)
  - `hasPending` derivado del resultado: `true` si algún backup tiene status `pending`
  - `pollIntervalMs` calculado: `5_000` si `hasPending`, `false` en caso contrario
- `frontend/src/hooks/useBackups.test.tsx` (nuevo):
  - 3 tests con `@testing-library/react` + Vitest
  - Verifica que `hasPending` y `pollIntervalMs` se calculan correctamente
  - Verifica que `useCreateBackup` invoca el api

## Decisiones técnicas

- **No migrar `BackupsView` al hook** — la vista tiene 776 líneas con state complejo (system status, advanced status, status filter, etc.). Una migración completa es scope para F7/F8. F6 deja el hook listo y testeado para que cualquier nueva vista pueda consumirlo.
- **`keepPreviousData` vs `placeholderData`** — en TanStack Query v4, `keepPreviousData` es el helper que mantiene los datos anteriores mientras carga la siguiente página. Da mejor UX que un spinner en cada paginación.
- **`pollIntervalMs` retornado, no aplicado** — la API pública del hook es: "toma este número y pásalo a tu propio `useQuery` o úsalo para un timer manual". Mantener la decisión en el caller da más flexibilidad (algunas vistas querrán poll, otras no).

## Quality gate

```
vitest       → 86 tests (3 nuevos) OK
tsc          → passed
eslint       → passed
```

## Próxima fase

F7 — Refactor de `NewInvoiceView.tsx` (1020 líneas, `useReducer` de 30 acciones) en sub-reducers. Riesgo alto. Trabajo grande.
