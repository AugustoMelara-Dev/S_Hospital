# S_Hospital - Main Unification Audit 2026-06-29

Date: 2026-06-29
Integration branch: `codex/main-unification-20260629`
Rollback branch: `checkpoint/pre-main-unification-20260629`
Rollback tag: `pre-main-unification-20260629`

## Baseline

- `main`: `742fdb55`
- `origin/main`: `742fdb55`
- Initial integration HEAD: `742fdb55`
- Policy: audit everything first; preserve dirty worktrees; integrate active product branches in reviewable batches.
- No branch deletion, stash deletion, force push, or `reset --hard` is allowed in this phase.

## Dirty Worktree Preservation

| Original worktree | Preservation branch | Commit | Decision |
|---|---|---:|---|
| `C:/tmp/S_Hospital_f6_global_design` | `preserve/f6-global-design-dirty-20260629` | `483f3239` | Preserved as evidence; not merged directly. Contains broad UI/QA screenshot changes. |
| `C:/tmp/S_Hospital_release_12062039` | `preserve/release-12062039-dirty-20260629` | `17cd1528` | Preserved as evidence; not merged directly. Contains release/script/doc line-ending scale changes. |
| `C:/tmp/S_Hospital_verify_b2fe0b43` | `preserve/verify-b2fe0b43-dirty-20260629` | `e96f8596` | Preserved as evidence; not merged directly. Contains very broad historical rewrite-style diffs. |

## Active Branch Inventory

| Branch | Ahead / behind `origin/main` | Head | Decision |
|---|---:|---|---|
| `codex/v1-2-visible-ui-delta` | 1 / 1 | `d9a807be feat(ui): deliver v1.2 visible workflow refinements` | Integrate first; current visible UI delta and release E2E fixes. |
| `codex/v1-2-full-ux-ui-redesign` | 4 / 4 | `65c31c70 test(ui): capture password change evidence` | Integrate after visible UI; resolve overlaps in favor of tested newer table/UI behavior. |
| `codex/v1-3-total-product-refactor` | 15 / 15 | `995223f7 docs(v1-3): record final hardening handoff` | Integrate after UI; contains security, auth, idempotency, receipt, and QA stabilization. |
| `codex/operational-role-simulation` | 10 / 10 | `b1a728ac fix(backups): persist current-user automation startup` | Integrate in operations batch if it does not regress newer hardening. |
| `codex/supply-chain-hardening` | 7 / 7 | `86e52a6b feat(deploy): implement robust network and docker preflight diagnostics v2 phase 1` | Integrate selectively/merge if compatible; strong offline LAN relevance. |
| `fix/f8-audit-hardening-2026-06-14` | 5 / 5 | `81d74d6e fix(backend): satisfy hardening quality gates` | Integrate in hardening batch; preserve backend security/audit changes. |
| `hardening-audit-complete-2026-06-15` | 4 / 4 | `6cecb4af Exclude vendored paths from offline dependency audit` | Integrate after F8; includes offline audit and backup/receipt hardening. |
| `codex/final-rc-scope-cutover` | 4 / 4 | `70df4b7e docs(qa): document final RC scope cutover` | Review/cherry-pick only; avoid reverting later UX/help behavior. |
| `preserve/refactor-platform-foundation-wip-20260628` | 1 / 1 | `b51e8a02 wip(preserve): snapshot refactor-platform-foundation working tree before v1.2 integration` | Cherry-pick only non-duplicated pieces if still useful. |

## Stashes

Local `git stash list` contains 35 entries, from `stash@{0}` through `stash@{34}`. They remain untouched. Rescue branches and stash-derived remote refs are treated as preservation evidence, not direct merge inputs.

## Integration Log

- Integrated: `codex/v1-2-visible-ui-delta` with a normal merge.
- Integrated: `codex/v1-2-full-ux-ui-redesign` with conflict resolution preserving the newer table platform, `useCashSession` options API, visible UI release fixes, and refreshed QA evidence.
- Integrated: `codex/v1-3-total-product-refactor` with conflict resolution limited to frontend test expectations.
- Integrated partially: `codex/operational-role-simulation`; kept backup/startup scripts and operational docs, rejected older frontend/report controller conflicts.
- Integrated partially: `codex/supply-chain-hardening`; kept offline LAN scripts/docs, policy/FormRequest hardening, and tests; rejected generated view files, backend package lock, duplicate PDF request, npmrc lockfile policy, and older infra conflicts.
- Integrated partially: `fix/f8-audit-hardening-2026-06-14`; kept backup protection metadata, LAN/preflight scripts, docs, and zero-total invoice payment registration; rejected older frontend/infra conflicts.
- Integrated partially: `hardening-audit-complete-2026-06-15`; kept offline/security docs, offline dependency audit scripts, and Windows restore script; rejected subagent/worklog artifacts and older backup/frontend/API conflicts.
- Cherry-picked documentation only: `codex/final-rc-scope-cutover` via `qa/FINAL_RC_CUTOVER_2026_06_12.md`; full branch would delete `GuidedTour` and overwrite current QA screenshots.
- No-op/preserved: `preserve/refactor-platform-foundation-wip-20260628`; useful RoleController, RoleCatalog, docs, and scripts already exist in current integration history.
- Verification fixes after integration:
  - Restored integration-test dependency `@testing-library/dom`.
  - Fixed invoice/category policies after branch merge exposed missing `InvoicePolicy::create()` and overly broad `CategoryPolicy::update()`.
  - Preserved zero-total dialysis invoices with an auditable zero-amount `payments` row linked to cash session, cashier, method, and date.
  - Scoped managerial reports without `cash.close_any` to the requesting user's activity.
  - Mounted required repo-root files into the backend Docker service so hardening tests can inspect `.gitignore`, `.github`, `nginx`, `setup.bat`, frontend E2E files, and production compose files from inside the container.

## Verification Gates

Frontend:

- `pnpm install --frozen-lockfile`: pass.
- `pnpm run typecheck`: pass.
- `pnpm run lint`: pass.
- `pnpm run test`: pass, 91 files / 523 tests.
- `pnpm run build`: pass.

Backend Docker:

- `docker compose config -q`: pass with local verification env.
- `docker compose up -d` initially failed on occupied/blocked host port `127.0.0.1:3306`; rerun with `DB_PORT=3307` passed.
- `docker compose exec -T backend composer install --no-interaction --prefer-dist`: pass.
- `docker compose exec -T backend php artisan migrate --seed`: pass.
- `docker compose exec -T backend php artisan test`: pass, 731 tests / 13 skipped / 4778 assertions.
- `docker compose exec -T backend vendor/bin/pint --test`: pass, 417 files.
- `docker compose exec -T backend vendor/bin/phpstan analyse`: failed only because container PHP memory limit was 128M.
- `docker compose exec -T backend vendor/bin/phpstan analyse --memory-limit=512M`: pass, no errors.

## Acceptance Criteria

- `main` and `origin/main` point to the same final SHA after merge and push.
- Worktree is clean on final branch.
- Every active branch above has an explicit decision in this file.
- Dirty worktrees are preserved in dedicated branches.
- Stashes and rescue branches are preserved.
- Relevant backend/frontend/E2E gates pass, or failures are documented as pre-existing/blocking with evidence.
