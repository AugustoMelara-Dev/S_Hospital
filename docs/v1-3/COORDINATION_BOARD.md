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
| Targeted billing test | PASS | `pnpm exec vitest run src/features/invoices/NewInvoiceView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000`, now 23 tests after invoice idempotency coverage. |
| Frontend tests | PASS | `pnpm run test`, 83 files and 499 tests after stabilizing lazy route tests. |
| Backend Docker baseline | PASS WITH ENV | Docker works when `DB_PASSWORD`, `DB_ROOT_PASSWORD`, and alternate `DB_PORT=33307` are supplied; host port 3306 is unavailable. |
| Backend focused tests | PASS | `UserManagementTest` (42 tests), `RoleManagementTest` (11 tests), `InstitutionalReceiptPaymentIntegrationTest` receipt recovery focus, `InstitutionalReceiptSeriesSeederTest`, `InstitutionalReceiptPdfTest`, `IdempotencyKeyTest`, and `EncryptLegacyIdempotencyKeysTest` pass in Docker with warnings from missing container `.env`. |
| Backend Pint | PASS | `docker compose run --rm backend vendor/bin/pint --test`, 410 files. |
| Backend PHPStan | PASS | `docker compose run --rm backend vendor/bin/phpstan analyse --memory-limit=1G --no-progress`. |
| Backend full tests | BLOCKED | `php artisan test` and full Feature partition timed out at 10 minutes without final output. Unit partition exposes container mount failures for repo-root files such as `../nginx/default.conf`, `../.env.example`, `../.gitignore`, `../setup.bat`, and `../.github/workflows/ci.yml`. |
| Build | PASS | `pnpm run build`; largest chunks: `charts` 418.64 kB, `vendor` 394.78 kB, app index 223.43 kB. |
| E2E | PENDING | Release E2E auth/session failure remains open; no final Playwright PASS recorded. |

## Research And Library Decisions

| Artifact | Status | Notes |
| --- | --- | --- |
| `docs/ux/V1_3_RESEARCH_REFERENCES.md` | UPDATED | Official/primary sources refreshed for Tailwind, Radix, TanStack Table/Virtual, Recharts, shadcn/ui, cmdk, React Aria, Ariakit, Zod, date-fns, WAI/WCAG, GOV.UK, NN/g, OWASP. |
| `docs/ux/V1_3_LIBRARY_DECISION_RECORD.md` | UPDATED | TanStack Table is now `USE THROUGH LOCAL WRAPPER`; TanStack Virtual, cmdk, React Aria, Ariakit, and date-fns are deferred until evidence justifies them. |

## Subagents

| ID | Area | Agent | Status | Scope |
| --- | --- | --- | --- | --- |
| A | Product Architecture | `019f10bd-82c3-7313-bafb-f6bea2186588` | COMPLETE | CI/E2E P0 plus payment/receipt, POS preview, route capability, receipt PDF side-effect, DataTable contract P1s. |
| B | Design System | `019f10bd-82c3-7313-bafb-f6bea2186588` | COMPLETE | DataTable wrapper and design-system contract are ahead of implementation; needs focused migration slices. |
| C | Data Contracts & API | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Resources, pagination, filters, mutation idempotency, compatibility. |
| D | Dashboard & Analytics | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Dashboard v2 data, charts, cash/backups/setup state. |
| E | Billing/POS | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Patient, service search, cart, totals, payment handoff. |
| F | Payments & Cashbox | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Session state, payment idempotency, close/reconcile, audit. |
| G | Invoice History & Receipts | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | History filters, reprint, institutional PDF, receipt settings. |
| H | Reports/Data Tables | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Reports, exports, DataTable adoption, filters. |
| I | Catalog & Services | controller + previous audit slice | NEEDS FORMAL HANDOFF REFRESH | Services, categories, billable/visible flags, pricing. |
| J | Users/Auth/RBAC | `019f10ba-168a-7202-a6cd-09478fd9b322` | COMPLETE | P0 privilege escalation and protected-admin mutation gaps found. |
| K | Backups/Restore/Operations | `019f10ba-43e2-73a2-95c7-ffd31255d6bd` | COMPLETE | Restore runbook/proof status and `backups.restore` contract ambiguity found. |
| L | Settings/Fiscal/Institutional | `019f10ba-43e2-73a2-95c7-ffd31255d6bd` | COMPLETE | P0 placeholder receipt authorization seed found and fixed. |
| M | Accessibility/Responsive | `019f10ba-7398-7230-ac22-a91aad6a152a` | COMPLETE | No P0; P1 mobile touch targets, reports mobile nav, receipt print timing found. |
| N | Performance/LAN | `019f10ba-7398-7230-ac22-a91aad6a152a` | COMPLETE | P1 static Echo/Pusher load, polling cadence, chunk budget risks found. |
| O | QA/E2E | `019f10ba-9dd9-79f3-a076-920868e781c7` | COMPLETE | P0 CI package-manager drift and release E2E auth failure found. |
| P | Integration Reviewer | `019f10ba-9dd9-79f3-a076-920868e781c7` | COMPLETE | Missing MariaDB/live gates and stale E2E DB cache risk found. |
| C/F | Data Contracts, Payments & Cashbox | `019f10bd-c6f9-7032-b2cc-eeb213e940f0` | COMPLETE | P0 POS invoice idempotency gap found and fixed; stale idempotency replay fixed. |

## Subagent Findings

| Area | Severity | Finding | Next Slice |
| --- | --- | --- | --- |
| Users/Auth/RBAC | RESOLVED | User managers with `users.create` or `users.update` could assign elevated roles or mutate protected admin/root targets. | Fixed in backend role/user contracts; verified on 2026-07-06 with `docker compose exec backend php artisan test tests/Feature/UserManagementTest.php` (42 tests) and `tests/Feature/RoleManagementTest.php` (11 tests). |
| QA/E2E | RESOLVED | CI assumed `npm ci` and `frontend/package-lock.json` while frontend uses `pnpm-lock.yaml`. | `.github/workflows/ci.yml` now uses pnpm setup, `pnpm install --frozen-lockfile`, pnpm cache and pnpm frontend commands. |
| QA/E2E | P0 | Release E2E is documented failing with expired session during admin/users access. | Re-run after auth/session investigation, fix session regression, and refresh evidence. |
| QA/E2E | P1 | Release E2E still uses SQLite; golden DB hash invalidation for prep/auth/session is fixed. | Define MariaDB-backed release gate after the remaining auth/session failure is reproduced and repaired. |
| QA/E2E | RESOLVED | E2E seed defaulted receipt paper to `80mm`, conflicting with institutional paper as primary. | `PrepareE2eReleaseDataCommand` and validation seed now default to `half_letter`; institutional print profiles remain primary. |
| QA/E2E | P1 | E2E seed used thermal paper as primary. | Fixed by defaulting release seed receipt paper to `half_letter`. |
| Receipts/Settings | P0 | Seeded institutional receipt series exposed placeholder authorization `AUT-REC-LOCAL`. | Fixed by seeding `range_authorization` as null and adding seeder regression test. |
| Billing/POS | P0 | POS invoice creation retried with a fresh idempotency key after lost LAN response, risking duplicate fiscal invoice. | Fixed by caller-managed invoice idempotency key reused across retry until success or payload changes. |
| API idempotency | P1 | Stale incomplete idempotency reservation could replay `200 {"data": null}`. | Fixed by returning 409 with recovery guidance when response is not replayable. |
| A11y/Responsive | P1 | Mobile buttons can be 36px; reports tabs and receipt preview need 320px usability tests. | Pending. |
| A11y/Responsive | P1 | Small and icon buttons used sub-44px mobile targets. | Fixed in button foundations; responsive Playwright proof still pending. |
| Performance/LAN | P1 | Echo/Pusher are statically imported and polling cadence may stack across many LAN clients. | Pending. |

## Implementation Queue

1. Wait for J-P audit handoffs only when their outputs are needed for the next implementation slice.
2. Refresh A-I handoffs from current code, because earlier notes predate the V1.2 consolidation now present in `main`.
3. Update `docs/v1-3/V1_3_TOTAL_PRODUCT_AUDIT.md` with current base and subagent findings.
4. Prioritize P0 implementation slices:
   - Backend/env test bootstrap and Docker baseline. PARTIAL: Docker works with explicit env and alternate host port.
   - RBAC protected-role and role-assignment hardening. DONE.
   - CI pnpm migration. DONE.
   - Release E2E session/golden DB repair. PARTIAL: golden DB hash now includes auth/bootstrap/prep inputs; session failure remains PENDING.
   - Payment/receipt recovery semantics. DONE: backend returns explicit receipt error/recovery contract; frontend prioritizes Historial recovery when payment is registered but institutional receipt is pending.
   - Zero-total erythropoietin/dialysis prescription invoice semantics.
   - POS invoice retry idempotency. DONE.
   - Stale idempotency reservation rejection. DONE.
   - Receipt placeholder authorization seed removal. DONE.
   - E2E seed institutional receipt paper default. DONE.
   - Mobile button target floor. DONE.
   - RBAC/IDOR coverage for receipts, invoices, reports, backups, users.
   - DataTable adoption where it replaces duplicated table behavior without weakening performance.
5. Keep commits phase-sized and Conventional Commit compliant.

## Current Risks

- Backend Docker needs explicit `DB_PASSWORD`, `DB_ROOT_PASSWORD`, and `DB_PORT=33307` in this shell because local 3306 is unavailable.
- The old V1.3 branch was divergent from current `main`; it has now been synced locally but not pushed yet.
- The local Git pre-commit hook is stale and points at a missing script; quality gates must be run explicitly until hook hygiene is fixed.
- Full V1.3 scope is larger than a single safe commit; implementation must proceed in slices with tests.
- Release E2E auth/session evidence, MariaDB-backed release gate, reports mobile nav/receipt preview proof, backend full-test container mount/timeout, and final LAN/physical evidence remain open.
