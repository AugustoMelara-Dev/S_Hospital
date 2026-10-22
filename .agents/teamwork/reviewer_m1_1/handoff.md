# Handoff Report — Reviewer M1-1 (Frontend UI & Visual Identity Reviewer)

**Date**: 2026-09-28  
**Agent**: Reviewer M1-1 (`teamwork_preview_reviewer`)  
**Roles**: Reviewer, Adversarial Critic  
**Parent Agent Conversation ID**: `afa577c2-4f95-4c65-bb23-5b3900e061e4`  
**Milestone**: M1 (Unified Visual Identity & Shell - R1)  
**Handoff Type**: Hard (Review Complete)  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Review Summary

**Verdict**: **REQUEST_CHANGES**  
**Overall Risk Assessment**: **MEDIUM**

Worker M1 successfully implemented core visual identity tokens, removed pre-auth bypasses in `App.tsx`, cleaned the proposal comparison card in `LoginView.tsx`, eliminated rogue emerald/purple classes across `ResumenView.tsx`, and passed strict legacy UI and clinical suites.

However, changes are requested due to **three concrete regressions**:
1. **Dangling Undefined CSS Variables (`--ui-free`)**: Worker M1 removed `--ui-free` and `--ui-free-subtle` from `tokens.css`, but left active call sites referencing `var(--ui-free)` and `var(--ui-free-subtle)` in `ResultZone.tsx`, `RecibosDetailPanel.tsx`, `InvoiceConfirmation.tsx`, and `styles.css`. This renders zero-cost operations and dialysis special rule adjustments unstyled/transparent.
2. **Broken Unit & Integration Test Suites**: While `npm run test:clinical` passed (177 tests), running the wider frontend test suites revealed that `components.test.tsx`, `AdminTable.mobile.test.tsx`, and `RecibosDetailPanel.test.tsx` fail because their test assertions still expect the old `'L 15.00'` format without period instead of the new `'L. 15.00'` standard.
3. **Broken Root Audit Script**: Invoking `node scripts/check-no-legacy-ui.mjs --mode=strict` from the repository root crashes with `ENOENT` due to referencing deleted file `DesignSystemProvider.tsx`.

---

## 2. Findings

### [Major] Finding 1: Dangling / Undefined `--ui-free` Tokens in Active Views and Styles
- **What**: CSS variables `--ui-free` and `--ui-free-subtle` were removed from `frontend/src/design-system/admin/tokens.css`, but 4 active files in `frontend/src` still reference `var(--ui-free)` and `var(--ui-free-subtle)`.
- **Where**:
  1. `frontend/src/features/cobrar/components/ResultZone.tsx:70`:
     ```tsx
     isZero
       ? 'bg-[var(--ui-free-subtle)] text-[color:var(--ui-free)]'
       : 'bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]'
     ```
  2. `frontend/src/features/recibos/RecibosDetailPanel.tsx:426`:
     ```tsx
     const tone = item.special_rule_applied
       ? 'text-[color:var(--ui-free)]'
       : 'text-[color:var(--ui-ink)]';
     ```
  3. `frontend/src/features/invoices/components/InvoiceConfirmation.tsx:127`:
     ```tsx
     <span className="shrink-0 font-semibold text-[color:var(--ui-free)]">GRATIS</span>
     ```
  4. `frontend/src/styles.css:474`:
     ```css
     --chart-3: var(--ui-free);
     ```
- **Why**: When a CSS variable is undefined, CSS falls back to initial/transparent values. On zero-total operations or dialysis lines, the icon container background is transparent, text color is unstyled, and `--chart-3` is invalid.
- **Suggestion**:
  - Replace `bg-[var(--ui-free-subtle)] text-[color:var(--ui-free)]` in `ResultZone.tsx` with neutral slate `bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink-soft)]` (matching `FreeMedicationBadge` and `STATUS_META.gratuito`).
  - In `RecibosDetailPanel.tsx`, use `text-[color:var(--ui-ink)]` or canonical blue `text-[color:var(--ui-action)]`.
  - In `InvoiceConfirmation.tsx`, style `GRATIS` with `text-[color:var(--ui-ink-soft)]`.
  - In `styles.css`, update `--chart-3` to a valid distinct token (e.g. `--ui-ink-faint` or `#6366F1`).

### [Major] Finding 2: Test Regressions in Non-Clinical Test Suites Due to "L. " Migration
- **What**: Test suites outside `test:clinical` were broken by the change in `formatLempirasUI`.
- **Where**:
  - `frontend/src/design-system/admin/components.test.tsx` (2 failed tests: lines 21, 84)
  - `frontend/src/design-system/admin/AdminTable.mobile.test.tsx` (1 failed test: line 61)
  - `frontend/src/features/recibos/RecibosDetailPanel.test.tsx` (3 failed tests: lines 124, 161, 190)
- **Why**: The assertions expect `'L 1,234.50'`, `'L 25.00'`, `'L 12.00'`, `'L 250.00'` without period, but `MoneyText` renders `'L. 1,234.50'`, `'L. 25.00'`, etc.
- **Suggestion**: Update test assertions in these files to expect the canonical `'L. '` format, consistent with the other updated test suites.

### [Major] Finding 3: Root Legacy UI Check Script Crashes with ENOENT
- **What**: Running `node scripts/check-no-legacy-ui.mjs --mode=strict` from the repository root fails with exit code 1.
- **Where**: `scripts/check-no-legacy-ui.mjs:22`
- **Why**: The root script maintains a hardcoded array `cleanFiles` containing `'frontend/src/design-system/providers/DesignSystemProvider.tsx'`, which was deleted.
- **Suggestion**: Update `scripts/check-no-legacy-ui.mjs` to remove nonexistent files, or have it delegate directly to `frontend/scripts/check-no-legacy-ui.mjs`.

### [Minor] Finding 4: Stale JSDoc Documentation in `ResumenView.tsx`
- **What**: JSDoc comments still reference "verde esmeralda institucional".
- **Where**: `frontend/src/features/resumen/ResumenView.tsx:51` and `ResumenView.tsx:432`.
- **Why**: Documentation drift. The component was successfully updated to cobalt blue `--ui-action`.
- **Suggestion**: Update comments to describe the cobalt blue canonical styling.

---

## 3. UI Polish & Engineering Review (`emil-design-eng` / `better-ui`)

| Before | After | Why |
|---|---|---|
| `bg-[var(--ui-free-subtle)] text-[color:var(--ui-free)]` (`ResultZone.tsx:70`) | `bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink-soft)]` | `--ui-free` token was deleted from `tokens.css`; leaves zero-cost operations with transparent background and unstyled icon |
| `item.special_rule_applied ? 'text-[color:var(--ui-free)]' : ...` (`RecibosDetailPanel.tsx:426`) | `item.special_rule_applied ? 'text-[color:var(--ui-action)]' : ...` | Avoid undefined CSS custom property; aligns with canonical cobalt blue action accent |
| `<span className="shrink-0 font-semibold text-[color:var(--ui-free)]">GRATIS</span>` (`InvoiceConfirmation.tsx:127`) | `<span className="shrink-0 font-semibold text-[color:var(--ui-ink-soft)]">GRATIS</span>` | Avoid undefined CSS variable; neutral slate is consistent with `FreeMedicationBadge` |
| `--chart-3: var(--ui-free);` (`styles.css:474`) | `--chart-3: #6366f1;` or `--chart-3: var(--ui-ink-faint);` | Fix invalid chart color reference after `--ui-free` removal |
| `expect(screen.getByText('L 1,234.50'))` (`components.test.tsx:21`) | `expect(screen.getByText('L. 1,234.50'))` | Synchronize test assertion with standardized `"L. "` format |
| `cleanFiles = [ ... 'frontend/src/design-system/providers/DesignSystemProvider.tsx' ... ]` (`scripts/check-no-legacy-ui.mjs:7`) | Remove deleted file or delegate to `frontend/scripts/check-no-legacy-ui.mjs` | Executing `node scripts/check-no-legacy-ui.mjs --mode=strict` from root throws ENOENT crash |

---

## 4. Adversarial Challenge & Stress-Testing

### Challenge 1: Undefined CSS Custom Properties in Special Rule Adjustments
- **Assumption challenged**: Removing `--ui-free` from `tokens.css` eliminated purple palette drift across the system.
- **Attack scenario**: User navigates to `/recibos` and inspects an invoice containing an EPO dialysis prescription, or completes a zero-total billing operation in `/cobrar`.
- **Blast radius**: The zero-cost badge in `ResultZone.tsx` loses its visual background container. In `RecibosDetailPanel.tsx`, the adjustment discount row renders without styled emphasis due to invalid CSS variable resolution.
- **Mitigation**: Update all 4 call sites to use canonical `--ui-surface-alt`, `--ui-ink-soft`, or `--ui-action`.

### Challenge 2: Test Suite Selection Bias
- **Assumption challenged**: Running `npm run test:clinical` validates that all UI currency format migrations are complete.
- **Attack scenario**: Running full regression test suites or running CI test gates on `design-system` or `recibos`.
- **Blast radius**: `components.test.tsx` fails (2 tests), `AdminTable.mobile.test.tsx` fails (1 test), `RecibosDetailPanel.test.tsx` fails (3 tests).
- **Mitigation**: Update assertions across all test files containing obsolete `'L '` strings.

---

## 5. Verified Claims

| Claim by Worker M1 | Verification Command / Method | Result | Notes |
|---|---|---|---|
| Canonical palette in `tokens.css` | `view_file` on `tokens.css` | **PASS** | Correctly defines #2563EB, #1D4ED8, #FFFFFF, #F8FAFC, #0F172A, #475569, #E2E8F0, #EFF6FF |
| Pre-auth bypass removed in `App.tsx` | `view_file` on `App.tsx` | **PASS** | Bypasses removed; all routes protected by session and auth guards |
| Proposal box removed in `LoginView.tsx` | `view_file` on `LoginView.tsx` | **PASS** | Marketing comparison card removed; clean login form |
| Rogue emerald/purple classes removed from `ResumenView.tsx` | `grep_search` on `ResumenView.tsx` | **PASS** | Zero emerald/purple/indigo/violet classes found |
| Rogue purple checkbox accent removed from `AccountZone.tsx` | `view_file` on `AccountZone.tsx:162` | **PASS** | Uses canonical `accent-[var(--ui-action)]` |
| Currency format standardized to `"L. 15.00"` | `view_file` on `money.ts`, `moneyCents.ts` | **PASS** | Correctly outputs `"L. 15.00"` with tabular numbers |
| `npm run typecheck` passes | `npm run typecheck` (PowerShell) | **PASS** | 0 errors (`tsc --noEmit`) |
| `npm run test:clinical` passes | `npm run test:clinical` (PowerShell) | **PASS** | 9 test files passed, 177 tests passed |
| Strict legacy UI check passes in `frontend/` | `node scripts/check-no-legacy-ui.mjs --mode=strict` | **PASS** | 0 violations across 396 files |
| Root legacy UI check passes | `node scripts/check-no-legacy-ui.mjs --mode=strict` (from root) | **FAIL** | Crashes with ENOENT (Finding 3) |
| All test suites synchronized with "L. " | `npx vitest run ...` on `components.test.tsx` & `RecibosDetailPanel.test.tsx` | **FAIL** | 6 failed tests across 3 test files (Finding 2) |

---

## 6. Coverage Gaps & Unverified Items

- **Playwright E2E Visual Verification**: Requires running MySQL and backend containers (`sh_ai_lab_local`). Deferred to Milestone M7 per project roadmap.
- **Historical Proposal Views (`frontend/src/features/propuestas/`)**: Files remain on disk for reference, but are unreachable at runtime due to `<Navigate to={adminRoutePaths.cobrar} replace />`.

---

## 7. 5-Component Handoff Protocol

### 7.1 Observation
- `frontend/src/features/cobrar/components/ResultZone.tsx` line 70 contains `bg-[var(--ui-free-subtle)] text-[color:var(--ui-free)]`.
- `frontend/src/features/recibos/RecibosDetailPanel.tsx` line 426 contains `text-[color:var(--ui-free)]`.
- `frontend/src/features/invoices/components/InvoiceConfirmation.tsx` line 127 contains `text-[color:var(--ui-free)]`.
- `frontend/src/styles.css` line 474 contains `--chart-3: var(--ui-free);`.
- `frontend/src/design-system/admin/tokens.css` does not define `--ui-free` or `--ui-free-subtle`.
- Running `node scripts/check-no-legacy-ui.mjs --mode=strict` from project root exited with code 1:
  `Error: ENOENT: no such file or directory, open 'C:\Projects\S_Hospital_AI\frontend\src\design-system\providers\DesignSystemProvider.tsx'`.
- Running `npx vitest run src/design-system/admin/components.test.tsx` exited with code 1:
  `FAIL src/design-system/admin/components.test.tsx (2 failed | 19 passed)`.
- Running `npx vitest run src/features/recibos/RecibosDetailPanel.test.tsx` exited with code 1:
  `FAIL src/features/recibos/RecibosDetailPanel.test.tsx (3 failed | 8 passed)`.

### 7.2 Logic Chain
1. When `--ui-free` was deleted from `tokens.css`, all references in the codebase became undefined variables.
2. Any component using `var(--ui-free)` fails to render intended text and background colors.
3. When `formatLempirasUI` was updated to prepend `"L. "`, test assertions expecting the previous `"L "` format fail unless synchronized.
4. Worker M1 updated tests in `test:clinical` but omitted `components.test.tsx`, `AdminTable.mobile.test.tsx`, and `RecibosDetailPanel.test.tsx`.
5. Therefore, changes must be requested to complete the token replacement and test assertion synchronization.

### 7.3 Caveats
- No integrity violations were detected: Worker M1 did not fabricate test logs or introduce mock facades. The issue is incomplete migration of call sites and test suites.

### 7.4 Conclusion
Verdict is **REQUEST_CHANGES**. Worker M1 must:
1. Replace dangling `var(--ui-free)` and `var(--ui-free-subtle)` in `ResultZone.tsx`, `RecibosDetailPanel.tsx`, `InvoiceConfirmation.tsx`, and `styles.css`.
2. Update outdated test assertions in `components.test.tsx`, `AdminTable.mobile.test.tsx`, and `RecibosDetailPanel.test.tsx`.
3. Fix root `scripts/check-no-legacy-ui.mjs` to eliminate the ENOENT error when run from repository root.

### 7.5 Verification Method
To verify the fixes, run:
```powershell
# 1. Verify root legacy check passes
cd c:\Projects\S_Hospital_AI
node scripts/check-no-legacy-ui.mjs --mode=strict

# 2. Verify frontend legacy check passes
cd c:\Projects\S_Hospital_AI\frontend
node scripts/check-no-legacy-ui.mjs --mode=strict

# 3. Verify zero lingering --ui-free references in src
# (PowerShell command; should return 0 matches)
git grep -- "--ui-free" src/

# 4. Verify TypeScript compilation
npm run typecheck

# 5. Verify all design system and receipts unit tests pass
npx vitest run src/design-system/admin/components.test.tsx src/design-system/admin/AdminTable.mobile.test.tsx src/features/recibos/RecibosDetailPanel.test.tsx

# 6. Verify clinical suite passes
npm run test:clinical
```
