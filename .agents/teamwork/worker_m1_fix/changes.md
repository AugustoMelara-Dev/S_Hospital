# Changes Report — Worker M1-Fix

**Date**: 2026-09-28
**Milestone**: M1 (Unified Visual Identity & Shell - R1) Remediation Iteration 2
**Agent**: Worker M1-Fix (`teamwork_preview_worker`)

---

## 1. Summary of Changes

This remediation addresses all issues identified by Reviewer M1-1, Challenger M1-1, and Challenger M1-2:
1. Eliminated all lingering references to deleted `--ui-free` and `--ui-free-subtle` tokens across runtime UI views and stylesheets.
2. Defined `--ui-text-2xs: 0.6875rem;` in `tokens.css` to properly support 11px compact badge text in `ResumenView.tsx` without invalid style fallback.
3. Updated test assertions in cobrar, design-system, and recibos unit test suites to match the canonical `"L. "` currency standard.
4. Repaired root `scripts/check-no-legacy-ui.mjs` to delegate cleanly to `frontend/scripts/check-no-legacy-ui.mjs`, supporting `--mode=strict` and eliminating `ENOENT` on missing files.

---

## 2. File-by-File Changes

### 2.1 CSS & Design System Tokens

- **`frontend/src/features/cobrar/components/ResultZone.tsx`** (lines 69-72):
  - Replaced `bg-[var(--ui-free-subtle)] text-[color:var(--ui-free)]` with `bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink-soft)]`.
  - Fixes unstyled icon container on zero-cost operations, matching `FreeMedicationBadge` and neutral slate status conventions.

- **`frontend/src/features/recibos/RecibosDetailPanel.tsx`** (lines 425-427):
  - Replaced `text-[color:var(--ui-free)]` with `text-[color:var(--ui-action)]`.
  - Fixes line adjustment cell tone for special rule items, using the canonical cobalt blue action accent.

- **`frontend/src/features/invoices/components/InvoiceConfirmation.tsx`** (line 127):
  - Replaced `text-[color:var(--ui-free)]` with `text-[color:var(--ui-ink-soft)]` on the `GRATIS` medication badge.

- **`frontend/src/styles.css`** (line 474):
  - Replaced `--chart-3: var(--ui-free);` with `--chart-3: #6366F1;`.
  - Provides a distinct, valid color series for chart rendering without referencing undefined custom properties.

- **`frontend/src/design-system/admin/tokens.css`** (line 61):
  - Added `--ui-text-2xs: 0.6875rem; /* 11px */` under typography scale tokens.
  - Ensures `text-[length:var(--ui-text-2xs)]` in `ResumenView.tsx` resolves accurately to 11px rather than invalidating to inherited 14px.

### 2.2 Root Legacy Audit Script

- **`scripts/check-no-legacy-ui.mjs`**:
  - Replaced hardcoded array of files with direct process delegation to `frontend/scripts/check-no-legacy-ui.mjs`.
  - Eliminates `ENOENT` crashes from moved/deleted legacy files and allows full parameter forwarding (`--mode=strict`, `--format=json`).

### 2.3 Test Assertion Synchronization ("L. " Format)

- **`frontend/src/features/cobrar/components/AccountZone.test.tsx`**:
  - Updated expected text from `'L 100.00 c/u'` to `'L. 100.00 c/u'` (line 134).
  - Updated `'L 100.00'` to `'L. 100.00'` (line 143).
  - Updated `'L 200.00'` to `'L. 200.00'` (line 153).
  - Updated `'L 100.00'` to `'L. 100.00'` (line 156).
  - Updated `'L 0.00'` to `'L. 0.00'` (line 182).
  - Updated `'L 0.00'` to `'L. 0.00'` (line 194).
  - Updated `'L 15.00'` to `'L. 15.00'` (line 198).

- **`frontend/src/features/cobrar/components/CatalogZone.test.tsx`**:
  - Updated `'L 15.00'` to `'L. 15.00'` (line 65).

- **`frontend/src/features/cobrar/components/ConfirmDialog.test.tsx`**:
  - Updated `'L 17.25'` to `'L. 17.25'` (line 113).

- **`frontend/src/features/cobrar/components/ResultZone.test.tsx`**:
  - Updated `'L 17.25'` to `'L. 17.25'` (line 89).

- **`frontend/src/features/cobrar/components/SummaryActionZone.test.tsx`**:
  - Updated `'L 17.25'` to `'L. 17.25'` (line 86).
  - Updated `'L 15.00'` to `'L. 15.00'` (line 87).
  - Updated `'L 2.25'` to `'L. 2.25'` (line 88).
  - Updated `'L 0.00'` to `'L. 0.00'` (line 89).
  - Updated `'Cobrar · L 17.25'` to `'Cobrar · L. 17.25'` (line 98).
  - Updated `not.toContain('L 0.00')` to `not.toContain('L. 0.00')` (line 144).

- **`frontend/src/design-system/admin/components.test.tsx`**:
  - Updated `'L 1,234.50'` to `'L. 1,234.50'` (line 21).
  - Updated `'L 25.00'` to `'L. 25.00'` (line 84).

- **`frontend/src/design-system/admin/AdminTable.mobile.test.tsx`**:
  - Updated `'L 250.00'` to `'L. 250.00'` (line 61).

- **`frontend/src/features/recibos/RecibosDetailPanel.test.tsx`**:
  - Updated `'L 137.39'` to `'L. 137.39'` (line 124).
  - Updated `'L 158.00'` to `'L. 158.00'` (line 125).
  - Updated `'L 40.00'` to `'L. 40.00'` (line 131).
  - Updated `'L 92.00'` to `'L. 92.00'` (line 132).
  - Updated `'L 2,500.00'` to `'L. 2,500.00'` (line 136).
  - Updated `'L 0.00'` to `'L. 0.00'` (line 142).
  - Updated `'L 12.00'` to `'L. 12.00'` (line 161).
  - Updated `'L 25.00'` to `'L. 25.00'` (line 190).

- **`frontend/src/features/recibos/RecibosTable.test.tsx`**:
  - Updated `'L 250.00'` to `'L. 250.00'` (line 178).

---

## 3. Verification Commands & Results

1. **Token Audit (Zero undefined `--ui-*` tokens in `src/`)**:
   `node -e "..."` -> `PASSED: All --ui-* tokens are defined in tokens.css`

2. **TypeScript Compilation**:
   `npm run typecheck` (`tsc --noEmit`) -> **0 errors**, Exit code: `0`

3. **Strict Legacy UI Audit (Frontend)**:
   `node scripts/check-no-legacy-ui.mjs --mode=strict` -> **396 files scanned, 0 violations**, Exit code: `0`

4. **Strict Legacy UI Audit (Root)**:
   `node scripts/check-no-legacy-ui.mjs --mode=strict` -> **396 files scanned, 0 violations**, Exit code: `0`

5. **Targeted Unit Test Suites**:
   `npx vitest run src/features/resumen/ src/features/cobrar/ src/design-system/admin/ src/features/recibos/`
   -> **20 test files passed (20/20), 170 tests passed (170/170)**, Exit code: `0`

6. **Clinical Test Suite**:
   `npm run test:clinical`
   -> **9 test files passed (9/9), 177 tests passed (177/177)**, Exit code: `0`
