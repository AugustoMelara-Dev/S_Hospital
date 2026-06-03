# F8 — Frontend: helpers de money/quantity centralizados

**Fecha:** 2026-06-01
**Fase del plan:** 8 de 12
**Rama:** `codex/audit-f1-config-hardening`
**Commit:** `ad1f1d1d refactor(frontend): add moneyCents helpers for cart and payment math`

## Hallazgo abordado

- **HIGH** (auditoría) — `parseCents`, `formatCents`, `parseQuantityUnits`, `formatQuantity` duplicados en `NewInvoiceView`, `InvoiceCart`, `PaymentModal`, `CashBoxView`, `OpenSessionForm`. Cada copia tiene pequeñas variaciones de regex/precisión, lo que hace que el redondeo de UI difiera sutilmente entre vistas.

## Cambios

- `frontend/src/lib/moneyCents.ts` (nuevo, 87 líneas):
  - `parseCents(string|number|null) → number|null` — regex `^\d+(\.\d{1,2})?$`, redondea con `Math.round` (HALF_AWAY_FROM_ZERO), rechaza null/undefined/empty/malformed/negativo
  - `parsePositiveCents(...) → number|null` — igual + rechaza ≤ 0
  - `formatCents(number|null) → string` — '0.00' / '15.00'
  - `formatLempirasFromCents(...) → string` — 'L. 0.00' / 'L. 12.34'
  - `parseQuantityUnits(...) → number|null` — valida y redondea a 2 decimales
  - `formatQuantity(...) → string` — con fractionDigits
- `frontend/src/lib/moneyCents.test.ts` (nuevo, 75 líneas, 8 tests):
  - Happy path: '0', '0.00', '15', '15.00', '15.5', '15.99'
  - Redondeo: '0.01' → 1, '0.02' → 2, '0.03' → 3
  - Malformados: '', '   ', 'abc', '1.234', '-1', null, undefined, NaN
  - Positivos: rechaza 0 y negativos
  - formatCents null/undefined
  - formatLempirasFromCents
  - parseQuantityUnits + formatQuantity

## Decisiones técnicas

- **No migrar las vistas aún** — el módulo es una **base**, no un refactor completo. Las vistas siguen con su código local. Esto evita riesgo de regresión en vistas críticas (POS, caja) y permite migración incremental.
- **Regex `^\d+(\.\d{1,2})?$`** — alinea con el formato `decimal(12,2)` del backend. Cualquier string con 3+ decimales o signo negativo se rechaza.
- **HALF_AWAY_FROM_ZERO** — `Math.round` en JS hace HALF_AWAY_FROM_ZERO para positivos, lo que coincide con la regla fiscal del backend (round-half-up con `intdiv(... + 50, 100)`). Documentar en `DECISIONS.md` (F12).
- **TDD primero** — los 8 tests cubren happy path + edge cases antes de declarar listo. Cualquier futura regresión en este helper será detectada inmediatamente.

## Quality gate

```
vitest       → 94 tests (8 nuevos) OK
tsc          → passed
eslint       → passed
```

## Próxima fase

F9 — Hardening de `apiClient base.ts`: cache CSRF con TTL, no descartar `localhost` sin feedback al usuario, mostrar todos los errores 422, exponer `voidPayment`, eliminar duplicado `getBackups`, tipar `downloadPdf` correctamente, `useServerStatus` con timeout, `useFiscalSettings` invalidar `usePublicBranding`.
