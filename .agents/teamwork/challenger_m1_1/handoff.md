# Handoff Report — Challenger M1-1 (Palette & Bypass Adversarial Verifier)

**Date**: 2026-09-28  
**Agent**: Challenger M1-1 (`teamwork_preview_challenger`)  
**Parent Agent Conversation ID**: `afa577c2-4f95-4c65-bb23-5b3900e061e4`  
**Milestone**: M1 (Unified Visual Identity & Shell - R1)  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### Obs 1.1: Authentication Bypasses & Proposal Routes
- In `frontend/src/App.tsx` (lines 92–105):
  ```tsx
  if (!session.user) {
    return (
      <LoginView
        login={session.login}
        password={session.password}
        status={session.status}
        onLoginChange={session.setLogin}
        onPasswordChange={session.setPassword}
        onSubmit={session.handleLogin}
        submitting={session.loginSubmitting}
        logoUrl={logoUrl}
      />
    );
  }
  ```
  Unauthenticated sessions unconditionally render `<LoginView />`. Neither `<AdminShell>` nor `<AppRoutes>` is mounted.
- In `frontend/src/AppRoutes.tsx` (lines 178–181):
  ```tsx
  {/* Rutas de propuestas redirigen al destino operativo canónico */}
  <Route path="/propuestas/*" element={<Navigate to={adminRoutePaths.cobrar} replace />} />
  <Route path="/cobrar-a" element={<Navigate to={adminRoutePaths.cobrar} replace />} />
  <Route path="/cobrar-b" element={<Navigate to={adminRoutePaths.cobrar} replace />} />
  ```
  All proposal routes redirect to `adminRoutePaths.cobrar` (`/cobrar`), which is gated by `<PermissionGate allowed={canAccessAdminItem(cobrar, user.permissions)} ...>`.
- `npx vitest run src/App.test.tsx src/AppRoutes.test.tsx`:
  ```
  Test Files  2 passed (2)
  Tests       10 passed (10)
  ```
  Zero routes can be accessed without authentication.

### Obs 1.2: Strict Legacy UI Quality Gate
- Command: `node scripts/check-no-legacy-ui.mjs --mode=strict` executed in `frontend/`.
- Verbatim result:
  ```
  [QUALITY GATE PASSED] modo=strict; 396 archivos; 0 violaciones.
  Módulos estrictos: src/App.tsx, src/components/ui/, src/components/AppErrorBoundary.tsx, src/components/PermissionGate.tsx, src/design-system/components/, src/design-system/admin/, src/design-system/patterns/, src/design-system/providers/, src/hooks/use-mobile.ts, src/hooks/useTheme.ts, src/navigation/adminNavigation.ts, src/shell/admin/, src/features/resumen/, src/features/cobrar/, src/features/recibos/, src/features/caja/, src/features/reportes/, src/features/administracion/, src/features/admin/, src/features/auth/, src/features/backups/, src/features/cash/, src/features/catalog/, src/features/receipts/, src/features/receipt-settings/, src/features/settings/, src/features/invoices/components/, src/features/invoices/history/, src/features/invoices/hooks/, src/features/invoices/state/, src/features/reports/components/, src/modules/accounting/, src/modules/billing/
  (Exit code: 0)
  ```

### Obs 1.3: Tokens Inspection & Dangling Token References
- In `frontend/src/design-system/admin/tokens.css`:
  - Rogue purple tokens `--ui-free: #6941c6`, `--ui-free-subtle`, `--ui-free-border` were deleted.
  - Canonical blue & neutral palette is properly declared (`--ui-action: #2563EB`, `--ui-action-hover: #1D4ED8`, `--ui-surface: #FFFFFF`, `--ui-paper: #F8FAFC`, `--ui-ink: #0F172A`, `--ui-ink-soft: #475569`, `--ui-line: #E2E8F0`, `--ui-action-subtle: #EFF6FF`).
- **CRITICAL DEFECT — Dangling references to deleted tokens**:
  Scanning all active files for `var(--ui-*)` usages revealed references to tokens that DO NOT EXIST in `tokens.css`:
  1. `frontend/src/features/cobrar/components/ResultZone.tsx` (line 70):
     ```tsx
     isZero
       ? 'bg-[var(--ui-free-subtle)] text-[color:var(--ui-free)]'
       : 'bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]',
     ```
  2. `frontend/src/features/invoices/components/InvoiceConfirmation.tsx` (line 127):
     ```tsx
     {dialysisPrescription && item.service.special_rule_code === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' ? (
       <span className="shrink-0 font-semibold text-[color:var(--ui-free)]">GRATIS</span>
     ) : (
     ```
  3. `frontend/src/features/recibos/RecibosDetailPanel.tsx` (line 426):
     ```tsx
     const tone = item.special_rule_applied
       ? 'text-[color:var(--ui-free)]'
       : 'text-[color:var(--ui-ink)]';
     ```
  4. `frontend/src/styles.css` (line 474):
     ```css
     --chart-3: var(--ui-free);
     ```
- **ADDITIONAL DEFECT — Undefined typography token**:
  5. `frontend/src/features/resumen/ResumenView.tsx` (lines 461, 466, 471):
     ```tsx
     // Line 461:
     <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ui-action-subtle-strong)] bg-[var(--ui-surface)] px-2 py-0.5 text-[length:var(--ui-text-2xs)] font-bold text-[color:var(--ui-action)]">
     // Line 466:
     <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] px-2 py-0.5 text-[length:var(--ui-text-2xs)] font-bold text-[color:var(--ui-warn)]">
     // Line 471:
     <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-2 py-0.5 text-[length:var(--ui-text-2xs)] font-bold text-[color:var(--ui-ink-soft)]">
     ```
     `--ui-text-2xs` is neither declared in `tokens.css` nor anywhere else in CSS. The smallest text token in `tokens.css` is `--ui-text-xs: 0.75rem;`.

### Obs 1.4: Currency Formatting Edge Cases
- `formatLempirasUI` in `frontend/src/lib/money.ts`:
  - `formatLempirasUI(0)` -> `'L. 0.00'`
  - `formatLempirasUI(15)` -> `'L. 15.00'`
  - `formatLempirasUI(1234.5)` -> `'L. 1,234.50'`
  - `formatLempirasUI(-15)` -> `'- L. 15.00'`
  - `formatLempirasUI(-50)` -> `'- L. 50.00'`
  - `formatLempirasUI('1234.5')` -> `'L. 1,234.50'`
  - `formatLempirasUI(null)` -> `'L. 0.00'`
  - `formatLempirasUI(undefined)` -> `'L. 0.00'`
  - `formatLempirasUI(NaN)` -> `'L. 0.00'`
  - `formatLempirasUI(Infinity)` -> `'L. 0.00'`
- `formatLempirasUIFromCents` in `frontend/src/lib/moneyCents.ts`:
  - `formatLempirasUIFromCents(0)` -> `'L. 0.00'`
  - `formatLempirasUIFromCents(1500)` -> `'L. 15.00'`
  - `formatLempirasUIFromCents(102925)` -> `'L. 1,029.25'`
  - `formatLempirasUIFromCents(-1500)` -> `'- L. 15.00'`
  - `formatLempirasUIFromCents(null)` -> `null` (by design: non-zero unprovided indicator)
  - `formatLempirasUIFromCents(undefined)` -> `null`
  - `formatLempirasUIFromCents(NaN)` -> `null`
  - `formatLempirasUIFromCents(Infinity)` -> `null`
- Test commands:
  - `npx vitest run src/lib/money.test.ts src/lib/moneyCents.test.ts` (14/14 passed)
  - `npm run test:clinical` (177/177 passed across 9 test files)
  - `npm run typecheck` (0 errors)

---

## 2. Logic Chain

1. **Authentication Bypass Evaluation (Supported by Obs 1.1)**:
   - Worker M1 claimed that all pre-auth bypasses were decommissioned.
   - Empirical tracing of `App.tsx` confirms that unauthenticated requests hit `if (!session.user) return <LoginView ... />` before any router or shell can render.
   - In `AppRoutes.tsx`, all proposal paths are redirected to `/cobrar`.
   - **Inference**: Authentication and routing boundaries are strictly protected.

2. **Strict Legacy UI Evaluation (Supported by Obs 1.2)**:
   - Worker M1 claimed 0 violations across 396 files in strict mode.
   - Running `node scripts/check-no-legacy-ui.mjs --mode=strict` confirms 0 violations.
   - **Inference**: Active operational views comply with the strict script quality gate.

3. **Token Integrity and Downstream Defect Analysis (Supported by Obs 1.3)**:
   - Worker M1 deleted `--ui-free` from `tokens.css` to comply with the mandate to eliminate purple accents for EPO/free rules.
   - In `components.tsx:370`, Worker M1 updated `FreeMedicationBadge` to neutral tokens (`--ui-line`, `--ui-surface-alt`, `--ui-ink-soft`).
   - However, Worker M1 omitted the remaining 4 occurrences in `ResultZone.tsx:70`, `InvoiceConfirmation.tsx:127`, `RecibosDetailPanel.tsx:426`, and `styles.css:474`.
   - Furthermore, in fixing `ResumenView.tsx`, Worker M1 used `text-[length:var(--ui-text-2xs)]` on lines 461, 466, and 471. Because `--ui-text-2xs` was never defined in `tokens.css`, `var(--ui-text-2xs)` is invalid at computed-value time in CSS and reverts to inherited font-size (14px from `.ui-root`), causing oversized text in status badges.
   - **Inference**: The token migration is incomplete, leaving ghost and undefined CSS variables in production UI views.

4. **Currency Formatting Evaluation (Supported by Obs 1.4)**:
   - The standardized format `"L. X.XX"` with space, period, and tabular numbers operates consistently across positive, negative, zero, and boundary inputs.
   - **Inference**: Currency formatting logic is robust.

---

## 3. Caveats

- **Historical files in `src/features/propuestas/`**: While these files still contain legacy purple/emerald utility classes, they are dead code unreachable from runtime routes. They fail in `--mode=final` but pass `--mode=strict`. They do not threaten the runtime production app.
- **E2E Playwright against real DB**: Not run during this verification because it requires backend and DB containers (reserved for later integration stages).

---

## 4. Conclusion & Verdict

**Verdict**: **REQUEST_CHANGES**

While authentication bypass removal, strict legacy checks, and currency formatting are completely verified, Worker M1 must fix the dangling and undefined token references before Milestone M1 can be approved.

### Required Actions for Worker M1:
1. **Fix dangling `var(--ui-free)` and `var(--ui-free-subtle)`**:
   - `frontend/src/features/cobrar/components/ResultZone.tsx:70`: Replace `bg-[var(--ui-free-subtle)] text-[color:var(--ui-free)]` with canonical neutral badge tokens: `bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink-soft)]` (matching `FreeMedicationBadge` in `components.tsx:370`).
   - `frontend/src/features/invoices/components/InvoiceConfirmation.tsx:127`: Replace `text-[color:var(--ui-free)]` with `text-[color:var(--ui-ink-soft)]` or `text-[color:var(--ui-ink)] font-semibold`.
   - `frontend/src/features/recibos/RecibosDetailPanel.tsx:426`: Replace `text-[color:var(--ui-free)]` with `text-[color:var(--ui-ink-soft)]`.
   - `frontend/src/styles.css:474`: Replace `--chart-3: var(--ui-free);` with `--chart-3: var(--ui-ink-faint);` or another canonical token.
2. **Fix undefined `var(--ui-text-2xs)`**:
   - In `frontend/src/design-system/admin/tokens.css`: Add `--ui-text-2xs: 0.6875rem; /* 11px */` under `/* Tipografía */`, OR in `frontend/src/features/resumen/ResumenView.tsx` lines 461, 466, 471 change `text-[length:var(--ui-text-2xs)]` to `text-[length:var(--ui-text-xs)]`.

---

## 5. Verification Method

To independently verify the fixes:
```powershell
cd c:\Projects\S_Hospital_AI\frontend

# 1. Verify zero undefined --ui-* tokens in src/
node -e "
import fs from 'node:fs';
import path from 'node:path';
const tokensCss = fs.readFileSync('src/design-system/admin/tokens.css', 'utf8');
const definedTokens = new Set([...tokensCss.matchAll(/--ui-[\w-]+/g)].map(m => m[0]));
function walk(dir) {
  let files = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!['node_modules', 'dist', 'coverage', '.git'].includes(ent.name)) files.push(...walk(full));
    } else if (/\.(tsx?|css)$/.test(ent.name)) files.push(full);
  }
  return files;
}
const missing = [];
for (const file of walk('src')) {
  if (file.includes('propuestas')) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const match of content.matchAll(/var\((--ui-[\w-]+)\)/g)) {
    if (!definedTokens.has(match[1])) missing.push({ file, token: match[1] });
  }
}
if (missing.length > 0) { console.error('FAILED:', missing); process.exit(1); }
console.log('PASSED: All --ui-* tokens are defined in tokens.css');
"

# 2. Strict UI audit
node scripts/check-no-legacy-ui.mjs --mode=strict

# 3. TypeScript compilation
npm run typecheck

# 4. Clinical test suite
npm run test:clinical
```

---

## Adversarial Review

### Challenge Summary
- **Overall risk assessment**: MEDIUM
- **Summary**: Security/bypass elimination is robust and strict audit passes, but incomplete token removal leaves broken CSS variables in financial result and invoice confirmation views.

### Challenges

#### [Medium] Challenge 1: Dangling CSS variables for deleted `--ui-free`
- **Assumption challenged**: Worker claimed purple tokens were eliminated from the visual identity.
- **Attack scenario**: When a cashier registers a zero-amount bill or an item under the EPO free medicine rule, `ResultZone.tsx`, `RecibosDetailPanel.tsx`, and `InvoiceConfirmation.tsx` apply `var(--ui-free)` and `var(--ui-free-subtle)`. In CSS, undeclared custom properties cause computed style invalidation and unstyled fallback.
- **Blast radius**: Cashier confirmation screens, receipt detail line adjustments, and charts.
- **Mitigation**: Update all 4 call sites to canonical neutral slate tokens (`--ui-surface-alt`, `--ui-ink-soft`).

#### [Low] Challenge 2: Undefined typography token `--ui-text-2xs`
- **Assumption challenged**: Worker cleaned 27 violations in `ResumenView.tsx` with canonical tokens.
- **Attack scenario**: Replacing classes with `var(--ui-text-2xs)` introduced a non-existent token, causing badge text in KPIs to default to 14px rather than 11px.
- **Blast radius**: `ResumenView` metric status badges.
- **Mitigation**: Add `--ui-text-2xs: 0.6875rem;` in `tokens.css` or use `--ui-text-xs`.

### Stress Test Results

| Scenario | Expected Behavior | Actual Behavior | Pass/Fail |
| --- | --- | --- | --- |
| Unauthenticated access to `/propuestas/cobrar-a` | Blocked / Render login view | Renders `LoginView` (0 protected requests) | PASS |
| Unauthenticated access to `/cobrar` | Blocked / Render login view | Renders `LoginView` | PASS |
| Authenticated access to `/propuestas/cobrar-a` | Redirects to `/cobrar` | Redirects to `/cobrar` | PASS |
| `check-no-legacy-ui.mjs --mode=strict` | 0 violations | 0 violations across 396 files | PASS |
| `tokens.css` purple token audit | Zero purple hex/tokens | Zero purple in `tokens.css`, BUT dangling references in 4 files | FAIL (Dangling refs) |
| `formatLempirasUI(0)` | `"L. 0.00"` | `"L. 0.00"` | PASS |
| `formatLempirasUI(15)` | `"L. 15.00"` | `"L. 15.00"` | PASS |
| `formatLempirasUI(1234.5)` | `"L. 1,234.50"` | `"L. 1,234.50"` | PASS |
| `formatLempirasUI(-15)` | `"- L. 15.00"` | `"- L. 15.00"` | PASS |
| `formatLempirasUI(NaN)` | `"L. 0.00"` | `"L. 0.00"` | PASS |
| `formatLempirasUIFromCents(null)` | `null` | `null` | PASS |

### Emil & Better-UI Review Table

| Before | After | Why |
| --- | --- | --- |
| `bg-[var(--ui-free-subtle)] text-[color:var(--ui-free)]` (ResultZone.tsx:70) | `bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink-soft)]` | `--ui-free` is deleted from `tokens.css`. Neutral slate matches `FreeMedicationBadge`. |
| `text-[color:var(--ui-free)]` (InvoiceConfirmation.tsx:127) | `text-[color:var(--ui-ink-soft)]` | `--ui-free` is deleted from `tokens.css`. |
| `text-[color:var(--ui-free)]` (RecibosDetailPanel.tsx:426) | `text-[color:var(--ui-ink-soft)]` | `--ui-free` is deleted from `tokens.css`. |
| `--chart-3: var(--ui-free)` (styles.css:474) | `--chart-3: var(--ui-ink-faint)` | `--ui-free` is deleted from `tokens.css`. |
| `text-[length:var(--ui-text-2xs)]` (ResumenView.tsx:461, 466, 471) | `text-[length:var(--ui-text-xs)]` (or declare `--ui-text-2xs: 0.6875rem` in tokens.css) | Token does not exist in `tokens.css`. |
