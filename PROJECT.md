# Project: Hospital General San Isidro Cashier System Reconstruction & Integration

## Architecture
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query + React Hook Form + Zod.
- **Backend**: Laravel 11 API + MySQL / MariaDB (`sh_ai_lab_local`) + DomPDF + PhpSpreadsheet.
- **Visual Identity**: Blue & White palette (`#2563EB`, `#1D4ED8`, `#FFFFFF`, `#F8FAFC`, `#0F172A`, `#475569`, `#E2E8F0`, `#EFF6FF`). Strictly no rogue green or purple accents in operational views.
- **Design Philosophy**: Adherence to `better-ui` and `emil-design-eng` (concentric radius `outer = inner + padding`, optical alignment, tabular numbers, tactile active scale `scale(0.96)`, `prefers-reduced-motion`).
- **Offline LAN**: 100% local operation without external dependencies or cloud bypasses.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Canonical Visual Tokens | Centralize tokens in `tokens.css` with Blue/White and Slate neutrals, removing purple `--ui-free` | M1 | R1, Mandato §2 |
| 2 | Decommission Lab Bypasses | Remove pre-auth bypass in `App.tsx`, promo box in `LoginView.tsx`, and eliminate A/B switcher from operative routes | M1 | R1, Mandato §1 |
| 3 | Strict Palette Enforcement | Eliminate emerald/indigo/purple classes from `ResumenView.tsx`, `CobrarView.tsx`, `components.tsx`; pass strict legacy UI check | M1 | R1, Mandato §2 |
| 4 | Currency Format Standardization | Unify currency display to `"L. 15.00"` with tabular numbers across all UI components | M1 | R1, Mandato §2 |
| 5 | Continuous Ledger Cashier Flow | Implement Proposal A continuous ledger (Patient -> Search/Insert -> Ledger Lines -> Summary -> Payment) in `CobrarView.tsx` | M2 | R2, Mandato §4 |
| 6 | Single Required Patient Field | Only patient name required; clean state on new operation (no inherited patient or EPO condition) | M2 | R2, Mandato §4 |
| 7 | Keyboard & Tactile Navigation | Enter in search adds item without submitting bill; accessible touch steppers for quantities | M2 | R2, Mandato §4 |
| 8 | Per-Line EPO Rule Display | Clear institutional badge "Sin cobro por receta" on eligible line item only; zero internal code exposure | M2 | R2, Mandato §4 |
| 9 | Server Monetary Authority | Real-time preview against `/api/invoices/preview`, exact cent arithmetic, idempotent submission | M2 | R2, Mandato §4 |
| 10 | Receipts & Operations History | Search by patient, number, date, status; robust pagination and detailed account modal/view | M3 | R3, Mandato §5 |
| 11 | Audited Reprint Flow | Reprint modal requiring mandatory human reason (5-500 chars), durable counter increment | M3 | R3, Mandato §5 |
| 12 | Cancellations & Reversals | Permissions-controlled invoice void and payment reversal with cashbox refund movements | M3 | R3, Mandato §5 |
| 13 | Cashbox Shift Management | Open shift with operator, initial cash float, physical register assignment; track payment methods | M4 | R4, Mandato §5 |
| 14 | Discriminado Cash Count & Arqueo | Physical denomination breakdown (expected vs counted vs difference); mandatory justification if difference != 0 | M4 | R4, Mandato §5 |
| 15 | Reconciled Cashbox Closing | Prevent closing if pending invoices or missing receipts; lock session movements upon closure | M4 | R4, Mandato §5 |
| 16 | Period & Filter Consistency | Strictly distinguish emission date, payment date, and cutoff date in report generation | M5 | R5, Mandato §6 |
| 17 | Executive PDF Reports | Monochrome printable PDF with key indicators, repeated table headers across pages, dynamic page numbering | M5 | R5, Mandato §6 |
| 18 | Executive Excel Workbooks | 5 structured sheets (Resumen, Operaciones, Detalle, Cobros, Caja) with real numeric floats, ExcelSafe anti-injection | M5 | R5, Mandato §6 |
| 19 | Institutional Receipt Profiles | Letter portrait (612x792 pt), Half-letter landscape (612x396 pt), A4/A5 with zero barcodes/QRs | M6 | R6, Mandato §7 |
| 20 | Print Preview & Decoupling | High-fidelity print preview without consuming correlatives; network/printer failure does not duplicate charge | M6 | R6, Mandato §7 |
| 21 | Quality Gate & Static Analysis | Pass `phpstan` Level 9 (0 errors) and `pint --test` (0 violations) across all backend action classes | M6 | Mandato §9, AC |
| 22 | Segmented Vitest Test Runner | Add uncovered test files to `segmented-tests-lib.mjs` and clean legacy test scripts in `package.json` | M7 | Mandato §9, AC |
| 23 | E2E Regression Specs & Mocks | Fix locator and mock mismatches in `caja-flow.spec.ts` and `recibos-flow.spec.ts` | M7 | Mandato §9, AC |
| 24 | Visual Capture & Evidence Artifacts | Capture 1440x900 and 390x844 real browser screenshots and archive sample PDF/Excel outputs | M7 | Mandato §9, AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Unified Visual Identity & Shell (R1) | Canonical palette tokens, remove lab bypasses, clean navigation shell, strict palette check | none | DONE |
| M2 | Cashier Station / Continuous Ledger (R2) | Proposal A continuous ledger, patient name only, clean start, EPO line badge, preview authority | M1 | DONE |
| M3 | Receipts & Operation History (R3) | Receipt history table, search, pagination, audited reprint modal, cancellation/reversal | M1 | PLANNED |
| M4 | Cashbox Management & Arqueo (R4) | Shift opening, movements, payment breakdown, discriminated arqueo, closing validation | M1 | PLANNED |
| M5 | Operational & Executive Reports (R5) | Period filters, monochrome executive PDF, 5-sheet Excel export, report service types | M1 | PLANNED |
| M6 | Institutional Receipt Printing & Static Gates (R6) | Letter & Half-letter profiles without QR/barcodes, print preview, resolve Larastan & Pint | M1, M2, M3 | PLANNED |
| M7 | Full E2E & Victory Audit Integration | Segmented Vitest, Playwright E2E suites, 1440x900/390x844 screenshots, evidence exports | M1-M6 | PLANNED |

## Interface Contracts
### Invoice Preview (`POST /api/invoices/preview`)
- Input: `{ patient_name: string, patient_dialysis_prescription: boolean, items: Array<{ service_id: number, quantity: number }> }`
- Output: `{ subtotal: string, discount: string, tax: string, total: string, subtotal_cents: number, total_cents: number, items: Array<{ service_id: number, description: string, quantity: number, unit_price_cents: number, rule_adjustment_cents: number, line_total_cents: number, special_rule_applied: boolean }> }`

### Invoice Store (`POST /api/invoices`)
- Input: `{ patient_name: string, patient_dialysis_prescription?: boolean, items: Array<{ service_id: number, quantity: number }> }`
- Output: 201 Created with `{ data: InvoiceResource }`

### Receipt Reprint (`POST /api/invoices/{id}/reprint`)
- Input: `{ reason: string }` (min 5, max 500 chars)
- Output: `{ data: InstitutionalReceiptResource, reprint_count: number }`

### Cashbox Close (`POST /api/cash-sessions/{id}/close`)
- Input: `{ closing_amount: number, closing_breakdown: Record<string, number>, notes?: string }`
- Output: `{ data: CashSessionResource }`

## Code Layout
- Frontend:
  - Tokens: `frontend/src/design-system/admin/tokens.css`
  - Shell & App: `frontend/src/App.tsx`, `frontend/src/features/navigation/`
  - Views: `frontend/src/features/{auth,resumen,cobrar,recibos,caja,reportes,administracion}/`
  - Scripts: `frontend/scripts/{check-no-legacy-ui.mjs,segmented-tests-lib.mjs,run-segmented-tests.mjs}`
  - Tests: `frontend/src/**/*.test.tsx`, `frontend/e2e/*.spec.ts`
- Backend:
  - Actions: `backend/app/Actions/{Billing,Cash,Receipts,InstitutionalReceipts,Reports}/`
  - Controllers: `backend/app/Http/Controllers/`
  - FormRequests: `backend/app/Http/Requests/`
  - Views/PDF: `backend/resources/views/pdf/`
  - Tests: `backend/tests/Feature/`
