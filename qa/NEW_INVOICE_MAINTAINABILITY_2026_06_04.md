# New invoice maintainability evidence - 2026-06-04

Decision: `PASSED`.

Scope:

- Verify that `frontend/src/features/invoices/NewInvoiceView.tsx` stays small enough for safe cashier-flow maintenance.
- Verify that data loading, cart behavior, invoice issue flow, payment flow, keyboard shortcuts, state transitions and layout remain extracted into dedicated hooks, state and components.
- Preserve this guard as part of the final production handoff so the cashier invoice flow does not silently become a large error-prone screen again.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_new_invoice_maintainability.ps1
```

Observed result:

- `NEW_INVOICE_MAINTAINABILITY: YES`.
- `NewInvoiceView.tsx` remains under the 200-line guardrail.
- The view keeps the extracted dependencies for invoice lifecycle, payment lifecycle, POS cart actions, POS data loading, keyboard shortcuts, reducer state and layout composition.
- The layout still composes patient entry, service search, invoice cart, invoice confirmation, payment modal, invoice success and receipt preview.
- Tests preserve coverage markers for accessibility, issuing, charging and dialysis behavior.

Safety notes:

- This guard does not start services, migrate, seed, restore data, print receipts or read `.env`.
- This guard does not replace browser smoke or final cashier training; it preserves a maintainability boundary for the critical invoice screen.
