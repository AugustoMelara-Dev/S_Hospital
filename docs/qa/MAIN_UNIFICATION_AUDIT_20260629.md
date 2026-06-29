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

- Pending: UI/V1.2 batch.
- Pending: V1.3/hardening functional batch.
- Pending: Offline LAN/operations batch.
- Pending: RC and WIP selective review.
- Pending: verification gates.

## Acceptance Criteria

- `main` and `origin/main` point to the same final SHA after merge and push.
- Worktree is clean on final branch.
- Every active branch above has an explicit decision in this file.
- Dirty worktrees are preserved in dedicated branches.
- Stashes and rescue branches are preserved.
- Relevant backend/frontend/E2E gates pass, or failures are documented as pre-existing/blocking with evidence.
