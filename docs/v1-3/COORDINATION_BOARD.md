# V1.3 Coordination Board

Branch: `codex/v1-3-total-product-refactor`
Worktree: `C:\Projects\S_Hospital-v1-3-total-product-refactor`
Base SHA: `e08f0e9d7bf740bcf10b7d0b036f6b05980acb42`
Base decision: start from `origin/main`; use V1.2 as reference only.

## Ground Rules

- Production physical approval remains `NO`.
- Release tag remains `NO`.
- No force push, reset, branch deletion, worktree removal, or automatic conflict choices.
- Contract changes require docs, migration plan, tests, idempotency review, permission review, and rollback notes.
- Source of truth: code, tests, migrations, API contracts, and AGENTS.md business rules.

## Baseline

| Gate | Status | Evidence |
| --- | --- | --- |
| `git fetch --all --prune` | PASS | Completed before branch creation. |
| `main` clean | PASS | `git status --short` returned empty. |
| `main == origin/main` | PASS | Both at `e08f0e9d7bf740bcf10b7d0b036f6b05980acb42`. |
| Checkpoint branch | PASS | `checkpoint/pre-v1-3-total-product-refactor-20260628-0636` pushed. |
| Frontend `npm ci` | PASS | 520 packages audited, 0 vulnerabilities. |
| Frontend typecheck | PASS | `npm run typecheck`. |
| Frontend lint | PASS | `npm run lint`. |
| Frontend tests | PASS | 82 files, 489 tests. |
| Frontend build | PASS | `npm run build`; largest chunks: `charts` 398.35 kB, `vendor` 348.15 kB. |
| Backend composer local | BLOCKED | `composer` command unavailable on host. |
| Backend Pint via Docker | PASS | `docker compose run --rm backend vendor/bin/pint --test`; 403 files. |
| Docker backend targeted tests | PASS WITH WARNINGS | `docker compose run --rm backend php artisan test --filter='InvoiceCreationTest|ServiceCatalogTest'`; 57 tests, 303 assertions. Warnings are repeated `file_get_contents(/var/www/html/.env)` because the container lacks an ignored `.env` file. |
| Docker backend full tests | INCONCLUSIVE | `docker compose run --rm backend php artisan test --colors=never` timed out after 4 minutes without useful output. No lingering test container remained. |

## Subagents

| ID | Area | Branch/Worktree | Status | Scope |
| --- | --- | --- | --- | --- |
| A | Product Architecture | current audit agent | COMPLETE | Payment/receipt atomicity, frontend fiscal preview, resource contracts, catalog search. |
| B | Design System | current audit agent | COMPLETE | Print-hidden utility, density tokens, receipt preview divergence, theme drift. |
| C | Data Contracts & API | current audit agent | COMPLETE | POS service filters, mutation idempotency, weak output contracts, OpenAPI gaps. |
| D | Dashboard & Analytics | current audit agent | COMPLETE | False cashier KPIs, manual dashboard fetch, cashbox visibility, LAN health, semantics. |
| E | Billing/POS | current audit agent | COMPLETE | Patient whitespace, zero-total paid invoices, stale cash session, auto-payment permissions. |
| F | Payments & Cashbox | current audit agent | COMPLETE | Partial payment retry, receipt failure after payment, movement adjustments, close_any. |
| G | Invoice History & Receipts | current audit agent | COMPLETE | PDF open records print event, permission mismatch, missing detail drawer, duplicate manual issue. |
| H | Reports/Data Tables | current audit agent | COMPLETE | Executive preset/date contract, audit 403 isolation, table scalability, report payload size. |
| I | Catalog & Services | current audit agent | COMPLETE | POS billable filter, billing-state flags, barcode/QR save, area contract drift. |
| J | Users/Auth/RBAC | pending | PENDING | Login, password change, users, roles, permissions, denied states. |
| K | Backups/Restore/Operations | pending | PENDING | Backup status, create/download, restore guidance, logs. |
| L | Settings/Fiscal/Institutional | pending | PENDING | Fiscal, receipt, branding, series, legal configured fields. |
| M | Accessibility/Responsive | pending | PENDING | WCAG, keyboard, focus, mobile 320-1366, no overflow. |
| N | Performance/LAN | pending | PENDING | Bundle, charts, tables, POS/report load on modest LAN PCs. |
| O | QA/E2E | pending | PENDING | Playwright specs, smoke, visual, production readiness gates. |
| P | Integration Reviewer | pending | PENDING | Final integration, conflicts, gates, risk acceptance. |

## Integration Queue

1. Launch remaining agents J-P after active agent slots free.
2. Convert remaining audit findings into scoped implementation slices.
3. Apply V1.2 useful frontend ideas selectively without reintroducing obsolete agent artifacts.
4. Resolve contractual decisions before touching payment/receipt atomicity or zero-total invoice semantics.
5. Run full gates and prepare final report.

## Completed V1.3 Fix Slices

| Slice | Status | Files |
| --- | --- | --- |
| POS service billing filter | DONE | Backend now validates/filters `visible_in_billing` and `is_billable`; `billing=1` means active + visible + billable. |
| Patient whitespace validation | DONE | `StoreInvoiceRequest` trims `patient_name` and rejects empty-after-trim values. |
| POS stale cash session | DONE | `NewInvoiceView` accepts `cashSession=null` and clears stale loaded session. |
| POS auto-payment permission guard | DONE | Auto-open payment after invoice now requires payment and receipt permissions. |
| POS payment idempotency | PARTIAL | Payment API accepts caller-managed key; POS keeps one key per open payment attempt until success/cancel. Refetch-after-timeout remains pending. |
| Print utility | DONE | `.print-hidden` now hides shell chrome in normal print media. |
| Catalog billing-state editing | DONE | `ServiceSheet` exposes visible/billable flags and preserves barcode/QR form values. |
| Report executive range | DONE | Executive reports allow 92 days; classic range reports remain 31 days. |
| Report preset desync | DONE | Child filter no longer emits stale `{ from, to }` keys after preset changes. |
| Manual receipt generation guard | DONE | Duplicate manual institutional receipt generation ref is set before request and reset in finally. |

## Current Risks

- V1.2 full redesign is useful but includes large obsolete agentic artifacts already cleaned from `main`.
- Host Composer is unavailable; Docker Composer works with local env variables and populated `backend/vendor`.
- Existing frontend build has large chart/vendor chunks that need LAN performance review before adding dependencies.
- No `docs/` existed in cleaned `main`; V1.3 docs are new phase artifacts.
- Payment success with institutional receipt failure still needs a product contract decision.
- Zero-total paid invoices for dialysis-prescription erythropoietin still need a payment/waiver contract decision.
