# ui-legacy-audit — Investigation Report

Three pre-existing test failures (since base commit `fe4b40f2`) in
`frontend/scripts/ui-legacy-audit.test.ts` against
`frontend/scripts/ui-legacy-audit.mjs`. Both worktrees reproduce the
failure identically:

- `C:\Projects\S_Hospital-base-fe4b40f2\frontend` — fails 3/22
- `C:\Projects\S_Hospital\frontend` (audit branch) — fails 3/22

```
× limits strict mode to migrated surfaces while final mode keeps all runtime violations
× keeps migrated shell and authentication surfaces in strict mode
× keeps migrated billing and receipt surfaces in strict mode
```

---

## 1. Exact violations produced by `scanSource` per fixture

`scanSource` output for each fixture was dumped to
`qa\pre-installation-final\ui-legacy-violations.txt`. Summary (line field
stripped):

### Test 1 — "limits strict mode to migrated surfaces…"

Fixture A — `src/components/ui/button.tsx`, source `"import 'antd';"`

```
{
  "file": "src/components/ui/button.tsx",
  "kind": "legacy-import",
  "dependency": "antd",
  "module": "ui-primitives",
  "message": "importación legacy prohibida de \"antd\"",
  "risk": "high",
  "consumer": "src/components/ui/button.tsx",
  "phaseOwner": "ui-primitives",
  "status": "backlog"
}
```

Fixture B — `src/features/reports/Report.tsx`, source `"import 'echarts';"`

```
{
  "file": "src/features/reports/Report.tsx",
  "kind": "legacy-import",
  "dependency": "echarts",
  "module": "reports",
  "message": "importación legacy prohibida de \"echarts\"",
  "risk": "high",
  "consumer": "src/features/reports/Report.tsx",
  "phaseOwner": "reports",
  "status": "backlog"
}
```

Combined violations: **2**. The `compat-surface` filename regex
(`(?:Compat|Legacy|Old|V1|Adapter|Antd)`) does **not** match `button`
or `Report`; neither source contains `Compat|Legacy|Old|V1`.

| Mode     | Expected | Got   |
|----------|----------|-------|
| inventory| 2        | 2     |
| strict   | **1**    | **2** |
| final    | 2        | 2     |

Both fixtures match a `strictModulePrefixes` entry:

- `src/components/ui/button.tsx` → `src/components/ui/`
- `src/features/reports/Report.tsx` → `src/features/reports/`

Neither is a `.test.tsx`/`.spec.tsx`/`.stories.tsx`, so both pass the
strict filter. Implementation returns 2.

### Test 2 — "keeps migrated shell and authentication surfaces…"

Fixture A — `src/shell/LegacyShell.tsx`, source `"import 'antd';"`

Two violations:

1. `compat-surface` — filename `LegacyShell.tsx` matches the filename
   regex (it contains `Legacy`); risk `high`.
2. `legacy-import` — `import 'antd';` matches the legacy-import pattern.

Fixture B — `src/features/auth/LegacyLogin.tsx`, source `"import '@ant-design/icons';"`

Two violations:

1. `compat-surface` — filename `LegacyLogin.tsx` matches the filename
   regex (`Legacy`).
2. `legacy-import` — `import '@ant-design/icons';` matches.

Combined violations: **4**. Both files match a `strictModulePrefixes`
entry (`src/shell/` and `src/features/auth/` respectively). Neither is a
test file.

| Mode     | Expected | Got   |
|----------|----------|-------|
| strict   | **2**    | **4** |

### Test 3 — "keeps migrated billing and receipt surfaces…"

Fixture A — `src/features/invoices/components/LegacyPayment.tsx`, source `"import 'antd';"`

Two violations (`compat-surface` from `Legacy` in filename + `legacy-import`).

Fixture B — `src/features/receipts/LegacyPreview.tsx`, source `"import '@ant-design/icons';"`

Two violations (same shape).

Combined violations: **4**. Both files match `strictModulePrefixes`
(`src/features/invoices/components/`, `src/features/receipts/`).

| Mode     | Expected | Got   |
|----------|----------|-------|
| strict   | **2**    | **4** |

---

## 2. Two independent divergences

There are exactly **two** bugs and they are independent. The expected
counts in the tests only align with the implementation if **both** are
fixed simultaneously.

### Divergence A — `src/features/reports/` is in `strictModulePrefixes`

`strictModulePrefixes` (mjs:13-41) lists:

```js
'src/features/reports/',
```

`filterViolationsForMode` (mjs:238-241) returns violations whose file
starts with one of those prefixes and is not a `.test|spec|stories`
file. So `src/features/reports/Report.tsx` survives strict filtering.

This is what causes Test 1 to receive 2 in strict mode (both fixtures
kept). The test expects only `src/components/ui/button.tsx` to survive,
so it expects `src/features/reports/` to NOT be in strict scope.

Git history (audit branch):

```
081e23f1  refactor(reports): complete shadcn report migration
          frontend/scripts/ui-legacy-audit.mjs | 2 ++
          +  'src/features/reports/',
          +  'src/modules/reports/',
```

The line was deliberately added by the approved shadcn migration of the
reports feature. It is intentional behavior, not a regression.

### Divergence B — `compat-surface` filename match fires on Legacy-prefix
files inside strict scope

`scanSource` (mjs:67-77) pushes a single `compat-surface` violation
whenever the basename matches `Compat|Legacy|Old|V1|Adapter|Antd`,
**regardless of strict scope**:

```js
if (/(?:^|\/)[^/]*(?:Compat|Legacy|Old|V1|Adapter|Antd)[^/]*\.(?:ts|tsx)$/.test(file)
    || /\b\w*(?:Compat|Legacy|Old|V1)\w*\b/.test(source)) {
  violations.push(makeViolation({ kind: 'compat-surface', ... }));
}
```

For Tests 2 and 3, every fixture file has `Legacy` in its basename, so
this block fires once per file **before** the legacy-import loop runs.
The legacy-import loop then fires again on the `import 'antd';` line.
Result: 2 violations per Legacy-prefix file.

The implementation has not changed on this rule since it was introduced
in `190fd7c7` (and extended in `3155b187`). The behavior is consistent.

### Where the test expectations diverge

| Test | File                                          | Test expects | Implementation produces | Cause             |
|------|-----------------------------------------------|--------------|--------------------------|-------------------|
| 1    | `src/components/ui/button.tsx`                | survives     | survives                 | —                 |
| 1    | `src/features/reports/Report.tsx`             | **dropped**  | survives                 | Divergence A      |
| 2    | `src/shell/LegacyShell.tsx` (×2 kinds)        | 1 violation  | 2 violations             | Divergence B      |
| 2    | `src/features/auth/LegacyLogin.tsx` (×2 kinds)| 1 violation  | 2 violations             | Divergence B      |
| 3    | `src/features/invoices/components/LegacyPayment.tsx` | 1 violation | 2 violations         | Divergence B      |
| 3    | `src/features/receipts/LegacyPreview.tsx`     | 1 violation  | 2 violations             | Divergence B      |

---

## 3. Verdict per test

### Test 1 — `limits strict mode to migrated surfaces…` — **CASE B**

**Test obsoleto por migración aprobada.**

Evidence:

- The test was added in `d7116abc feat(ui): establish shadcn foundation`.
  At that time `src/features/reports/` was NOT in `strictModulePrefixes`,
  so the test's `toHaveLength(1)` matched reality.
- Commit `081e23f1 refactor(reports): complete shadcn report migration`
  later added `'src/features/reports',` and `'src/modules/reports',` to
  `strictModulePrefixes`. The migration was approved.
- The test was never updated. It still encodes the pre-migration
  intent (reports is not yet migrated → excluded from strict).
- The implementation correctly reflects the post-migration state
  (commit message: *"complete shadcn report migration"*).

The test's fixture and intent are correct in isolation, but the
implementation is the source of truth after an approved migration.

### Test 2 — `keeps migrated shell and authentication surfaces…` — **CASE A**

**Defecto real de la implementación.**

Evidence:

- Added in commit `99428513 refactor(ui): migrate shell and authentication
  to shadcn` **together with** the addition of `'src/shell/'` and
  `'src/features/auth/'` to `strictModulePrefixes`.
- The test fixture names (`LegacyShell.tsx`, `LegacyLogin.tsx`) carry
  `Legacy` in their basename. The test author encoded the rule that
  "Legacy-prefix files in migrated (strict-scope) surfaces contribute
  exactly **one** strict-mode violation per file (the legacy-import).
  The `compat-surface` filename rule should not double-count them,
  because they are artifacts of the in-progress migration."
- The implementation fires `compat-surface` regardless of strict scope,
  producing 2 violations per file.
- Inventory / final coverage is unaffected by a strict-scope-only fix.
- No migration was approved that would justify over-counting in strict
  mode.

### Test 3 — `keeps migrated billing and receipt surfaces…` — **CASE A**

**Defecto real de la implementación.**

Same root cause as Test 2 (`Legacy`-prefix files in strict scope).
Added in commit `860ec7d8 refactor(billing): migrate invoice and
receipt flow to shadcn`, alongside the addition of
`src/features/invoices/components/` and `src/features/receipts/` to
`strictModulePrefixes`.

---

## 4. Minimum source change needed

**No edit performed.** This is the proposed minimum to make the three
failing tests pass **without** reducing inventory/final coverage and
**without** using `.skip` / `.todo` / `test.only` / `describe.only` /
deleting asserts / removing audit scope.

### Fix for Test 1 (CASE B) — test.ts

The test reflects pre-migration intent that no longer matches the
implementation. Update the test's expected length to match the
post-migration strict scope.

`frontend/scripts/ui-legacy-audit.test.ts:54`:

```diff
-    expect(filterViolationsForMode(violations, 'strict')).toHaveLength(1);
+    expect(filterViolationsForMode(violations, 'strict')).toHaveLength(2);
```

(Inventory `2` and final `2` already match — they need no change.)

### Fix for Tests 2 and 3 (CASE A) — ui-legacy-audit.mjs

The defect is in `filterViolationsForMode`. The strict filter must not
double-count a `compat-surface` and a `legacy-import` on the same file
inside strict scope: when the file is already tracked for a real legacy
import, the filename-based `compat-surface` is redundant (the file is
in active migration) and should be suppressed in strict mode only.

Proposed change to `filterViolationsForMode` (mjs:235-243):

```js
export function filterViolationsForMode(violations, mode) {
  if (mode === 'inventory') return violations;
  if (mode === 'final') {
    return violations.filter(
      (violation) => !/\.(?:test|spec|stories)\.(?:ts|tsx)$/.test(violation.file),
    );
  }
  if (mode === 'strict') {
    const inStrictScope = strictModulePrefixes.some((prefix) =>
      violations[0]?.file.startsWith(prefix),
    );
    const scoped = violations.filter(
      (violation) =>
        strictModulePrefixes.some((prefix) => violation.file.startsWith(prefix))
        && !/\.(?:test|spec|stories)\.(?:ts|tsx)$/.test(violation.file),
    );
    // Suppress compat-surface inside strict scope when the same file
    // already carries a legacy-import (the file is in active migration).
    const filesWithLegacyImport = new Set(
      scoped.filter((v) => v.kind === 'legacy-import').map((v) => v.file),
    );
    return scoped.filter(
      (violation) => !(violation.kind === 'compat-surface' && filesWithLegacyImport.has(violation.file)),
    );
  }
  throw new Error(`Modo desconocido: ${mode}`);
}
```

(The `inStrictScope`/`scoped` scaffolding above is one of several ways
to express it. A more compact equivalent: build a `Set` of
`legacy-import` files from `scoped`, then filter `scoped` by removing
`compat-surface` entries whose file is in that set.)

This change:

- Inventory mode: untouched. Coverage unchanged.
- Final mode: untouched. Coverage unchanged.
- Strict mode: dedupes `compat-surface` per file when a `legacy-import`
  is already present for that file. Inventory/final still keep both.

---

## 5. Risk analysis

For the Test 1 CASE B fix (test.ts):

- Zero risk to production behavior.
- Updates a fixture assertion to match post-migration reality. The
  audit branch already documents the migration in commit `081e23f1`.

For the Tests 2/3 CASE A fix (mjs):

- **Inventory coverage:** unchanged. The fix is in `filterViolationsForMode`,
  not in `scanSource`. `scanSource` still produces the same N violations
  per file in all modes.
- **Final coverage:** unchanged (final mode does not run the dedup).
- **Strict coverage:** reduces from 4 to 2 for `Legacy`-prefix files in
  strict scope. This is the *intended* behavior per the tests.
- **Other tests in the same file:** verified manually that no other
  test in `ui-legacy-audit.test.ts` exercises a `compat-surface` +
  `legacy-import` pair inside strict scope. All other tests either
  use `src/shared/...` (not in strict scope) or do not combine
  `compat-surface` with another violation in strict scope.
- **Production caller:** `frontend/scripts/check-no-legacy-ui.mjs`
  consumes `filterViolationsForMode` with `--mode=strict|final|inventory`.
  Strict mode currently surfaces double-counts on in-progress migration
  files; after the fix it surfaces one violation per file in migrated
  surfaces, which is the desired gate semantics.

---

## 6. Verification

Both worktrees reproduce the failure with verbose output:

```bash
cd C:\Projects\S_Hospital\frontend
npx vitest run scripts/ui-legacy-audit.test.ts --reporter=verbose --config vitest.unit.config.ts
# → 3 failed | 19 passed (22)
```

```bash
cd C:\Projects\S_Hospital-base-fe4b40f2\frontend
npx vitest run scripts/ui-legacy-audit.test.ts --reporter=verbose --config vitest.unit.config.ts
# → 3 failed | 19 passed (22)
```

Identical failing assertions in both:

- `expected [ { …(10) }, { …(10) } ] to have a length of 1 but got 2` (Test 1)
- `expected [ { …(9) }, { …(10) }, { …(9) }, …(1) ] to have a length of 2 but got 4` (Test 2)
- `expected [ { …(9) }, { …(10) }, { …(9) }, …(1) ] to have a length of 2 but got 4` (Test 3)

The 19 passing tests cover radius/shadow vocabulary, color literals in
central tokens, approved shadcn stack, gradients/glass/arbitrary
dimensions, compatibility surfaces, module specifiers, native
interactive controls, application tables, the four documented semantic
table files, the five forbidden parallel visual surfaces in
`src/shared/`, the Sheet primitive, and test-fixture gating. None of
these is affected by either proposed fix.

---

## 7. Summary

| Test | Case | Where the fix lives | One-line change |
|------|------|----------------------|-----------------|
| "limits strict mode to migrated surfaces…" | **B** | `ui-legacy-audit.test.ts:54` | `1` → `2` |
| "keeps migrated shell and authentication surfaces…" | **A** | `ui-legacy-audit.mjs:235-243` (`filterViolationsForMode`) | dedup `compat-surface` per file when a `legacy-import` is already present in strict scope |
| "keeps migrated billing and receipt surfaces…" | **A** | same as above | same dedup |

No `.skip`, `.todo`, `test.only`, `describe.only`, deleted assertions,
or removed audit scope is required.

No production code, no commits performed.