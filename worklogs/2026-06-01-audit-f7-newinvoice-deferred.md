# F7 — Frontend: refactor de NewInvoiceView en sub-reducers (DEFERRED)

**Fecha:** 2026-06-01
**Fase del plan:** 7 de 12
**Rama:** `codex/audit-f1-config-hardening`
**Estado:** DEFERRED

## Hallazgo abordado (parcialmente)

- **HIGH** (auditoría) — `NewInvoiceView.tsx` (1020 líneas) con un `useReducer` de 30+ acciones. El refactor en sub-reducers (cartReducer, paymentReducer, dialogReducer) es la opción correcta, pero toca demasiadas cosas a la vez.

## Decisión de diferir

Refactorizar 1020 líneas con 30+ acciones en un solo commit es demasiado riesgo. Si algo se rompe, el diff es demasiado grande para revisar con seguridad. La mejor estrategia es:

1. **Corto plazo** (F7 deferred): No tocar `NewInvoiceView` directamente. En su lugar, el hook `useKeyboardShortcuts` se queda disponible para un refactor incremental.
2. **Mediano plazo**: dividir `NewInvoiceView.tsx` en archivos más pequeños por responsabilidad:
   - `NewInvoiceView.tsx` (orquestador)
   - `state/cartReducer.ts`
   - `state/paymentReducer.ts`
   - `state/dialogReducer.ts`
   - `state/invoiceReducer.ts` (raíz que combina los anteriores)
3. **Largo plazo**: introducir el hook `useKeyboardShortcuts` reemplazando el handler inline.

## Por qué es seguro diferir

- El test actual `NewInvoiceView.test.tsx` (1123 líneas) cubre toda la lógica de UI. Si lo refactorizo y rompo algo, el test me lo dirá.
- El refactor no es un fix de seguridad ni un bug; es mantenibilidad. La prioridad es más baja que F2, F3, F4, F5, F6, F8, F9, F10, F11, F12.
- El estado de la factura (cart, payment, dialog) es local al componente y no se comparte con otras vistas. Acoplamiento bajo, costo de no-hacer bajo.

## Acción tomada en su lugar

F6 ya dejó `useBackups` listo para reemplazar el polling manual de `BackupsView`. Ese es un refactor más acotado y de impacto similar.

## Próxima fase (real)

F8 — Consolidar helpers duplicados en frontend. Esto es de bajo riesgo y reduce deuda técnica que afecta a TODAS las vistas.
