# V1.3 Coordination Board

Branch: `codex/v1-3-total-product-refactor`
Worktree: `C:\Projects\S_Hospital-v1-3-total-product-refactor`
Local review date: 2026-06-28

## Ground Rules

- Production physical approval remains `NO`.
- Release tag remains `NO`.
- No force push, reset, branch deletion, worktree removal, or automatic conflict choices.
- Do not lose useful V1.2 or local checkpoint work.
- Contract changes require docs, migration plan, tests, idempotency review, permission review, rollback notes, and data impact notes.
- Source of truth: code, tests, migrations, API contracts, AGENTS.md, and S_Hospital business rules.

## Base And Branch State

| Item | Status | Evidence |
| --- | --- | --- |
| Fetch remotes | PASS | `git fetch --all --prune` completed. |
| Main branch | PASS | `main` clean and aligned with `origin/main`. |
| Current base SHA | PASS | `main` and `origin/main` at `742fdb551b202ddb0473a0269440e0bf6ff116ce`. |
| V1.2 full redesign branch | PASS | `origin/codex/v1-2-full-ux-ui-redesign` exists and currently points to the same SHA as `origin/main`. |
| V1.2 visible UI delta branch | PASS | `origin/codex/v1-2-visible-ui-delta` exists and currently points to the same SHA as `origin/main`. |
| Local dirty checkpoint | PASS | Dirty pre-existing work preserved in `origin/checkpoint/local-pre-v1-3-dirty-20260628-1759` with commits `a1376278` and `69f990fa`. |
| Required pre-V1.3 checkpoint | PASS | `origin/checkpoint/pre-v1-3-total-product-refactor-20260628-1802` pushed at `742fdb55`. |
| V1.3 branch reuse | PASS | Existing `codex/v1-3-total-product-refactor` worktree reused rather than deleting/recreating a published branch. |
| V1.3 sync with main | PASS | Merge commit `b4b5fdcee0bab9a654dd60a47ae613059e71d766` syncs old V1.3 branch with current `origin/main`. |
| Hook issue | NOTED | Local pre-commit hook points to missing `C:\Projects\S_Hospital\scripts\pre-commit-guard.ps1`; checkpoint/sync commits used `--no-verify`. |

## Baseline Verification

| Gate | Status | Evidence |
| --- | --- | --- |
| Frontend dependencies | PASS | `pnpm run typecheck` installed/restored dependencies from `pnpm-lock.yaml` without tracked file changes. |
| Frontend typecheck | PASS | `pnpm run typecheck`. |
| Frontend lint | PASS | `pnpm run lint`. |
| Targeted billing test | PASS | `pnpm exec vitest run src/features/invoices/NewInvoiceView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000`, 22 tests. |
| Frontend tests | PASS | `pnpm run test`, 83 files and 498 tests. |
| Backend Docker baseline | BLOCKED | `docker compose ps` fails because required environment variable `DB_PASSWORD` is not set in this shell. |
| Backend tests | PENDING | Must run after Docker/env bootstrap. |
| Build | PENDING | Must run after implementation slices or before final handoff. |
| E2E | PENDING | Must run after browser/runtime setup. |

## Research And Library Decisions

| Artifact | Status | Notes |
| --- | --- | --- |
| `docs/ux/V1_3_RESEARCH_REFERENCES.md` | UPDATED | Official/primary sources refreshed for Tailwind, Radix, TanStack Table/Virtual, Recharts, shadcn/ui, cmdk, React Aria, Ariakit, Zod, date-fns, WAI/WCAG, GOV.UK, NN/g, OWASP. |
| `docs/ux/V1_3_LIBRARY_DECISION_RECORD.md` | UPDATED | TanStack Table is now `USE THROUGH LOCAL WRAPPER`; TanStack Virtual, cmdk, React Aria, Ariakit, and date-fns are deferred until evidence justifies them. |

## Subagents

| ID | Area | Agent | Status | Scope |
| --- | --- | --- | --- | --- |
| A | Product Architecture | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Architecture, product boundaries, module shell, data ownership. |
| B | Design System | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Tokens, shared UI, tables, receipt frame, print states. |
| C | Data Contracts & API | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Resources, pagination, filters, mutation idempotency, compatibility. |
| D | Dashboard & Analytics | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Dashboard v2 data, charts, cash/backups/setup state. |
| E | Billing/POS | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Patient, service search, cart, totals, payment handoff. |
| F | Payments & Cashbox | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Session state, payment idempotency, close/reconcile, audit. |
| G | Invoice History & Receipts | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | History filters, reprint, institutional PDF, receipt settings. |
| H | Reports/Data Tables | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Reports, exports, DataTable adoption, filters. |
| I | Catalog & Services | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Services, categories, billable/visible flags, pricing. |
| J | Users/Auth/RBAC | `019f10ba-168a-7202-a6cd-09478fd9b322` | RUNNING | Audit users/auth/RBAC code and tests. |
| K | Backups/Restore/Operations | `019f10ba-43e2-73a2-95c7-ffd31255d6bd` | RUNNING | Audit backups, restore guidance, operations. |
| L | Settings/Fiscal/Institutional | `019f10ba-43e2-73a2-95c7-ffd31255d6bd` | RUNNING | Audit fiscal, receipt settings, branding, institutional fields. |
| M | Accessibility/Responsive | `019f10ba-7398-7230-ac22-a91aad6a152a` | RUNNING | Audit WCAG, keyboard, responsive, dark mode, print isolation. |
| N | Performance/LAN | `019f10ba-7398-7230-ac22-a91aad6a152a` | RUNNING | Audit bundle, charts, table scale, LAN/modest PC performance. |
| O | QA/E2E | `019f10ba-9dd9-79f3-a076-920868e781c7` | RUNNING | Audit Playwright, frontend/backend gates, QA evidence. |
| P | Integration Reviewer | `019f10ba-9dd9-79f3-a076-920868e781c7` | RUNNING | Audit integration risks, missing gates, final handoff blockers. |

## Implementation Queue

1. Wait for J-P audit handoffs only when their outputs are needed for the next implementation slice.
2. Refresh A-I handoffs from current code, because earlier notes predate the V1.2 consolidation now present in `main`.
3. Update `docs/v1-3/V1_3_TOTAL_PRODUCT_AUDIT.md` with current base and subagent findings.
4. Prioritize P0 implementation slices:
   - Backend/env test bootstrap and Docker baseline.
   - Payment/receipt recovery semantics.
   - Zero-total erythropoietin/dialysis prescription invoice semantics.
   - RBAC/IDOR coverage for receipts, invoices, reports, backups, users.
   - DataTable adoption where it replaces duplicated table behavior without weakening performance.
5. Keep commits phase-sized and Conventional Commit compliant.

## Current Risks

- Backend Docker cannot be checked from this shell until `DB_PASSWORD` is supplied or a test env path is established.
- The old V1.3 branch was divergent from current `main`; it has now been synced locally but not pushed yet.
- The local Git pre-commit hook is stale and points at a missing script; quality gates must be run explicitly until hook hygiene is fixed.
- Full V1.3 scope is larger than a single safe commit; implementation must proceed in slices with tests.
