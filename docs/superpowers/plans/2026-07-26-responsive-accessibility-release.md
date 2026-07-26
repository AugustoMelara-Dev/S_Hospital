# Responsive, Accessibility, and Release Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-audit every S_Hospital module after financial, recovery, and installer changes; fix reproducible UI/accessibility defects; and certify the complete offline release.

**Architecture:** Extend the existing Playwright route matrix rather than create a second audit framework. Capture geometry, axe results, console/network failures, focus behavior, and screenshots for canonical states at six viewports plus 200% reflow.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Radix/shadcn components, Vitest, Testing Library, Playwright 1.61, axe-core, Laravel/MySQL-MariaDB.

## Global Constraints

- UI remains sober, fast, and usable for hospital cash operations.
- All critical actions have accessible names, visible focus, and keyboard operation.
- No horizontal page overflow at supported widths.
- Critical errors remain visible until acknowledged; reduced-motion is respected.
- Financial totals shown after emission come from the backend response.
- No QR, barcode, or internal codes appear on the principal institutional receipt.
- Fix only reproducible findings related to the goal; avoid unrelated redesign.
- Every behavior change follows red-green-refactor and ends in a Conventional Commit.

---

### Task 1: Refresh the route/state audit inventory

**Files:**
- Modify: `frontend/e2e/accessibility.spec.ts`
- Modify: `frontend/e2e/production-readiness.spec.ts`
- Modify: `docs/audit/manual-ui/01-route-matrix.md`
- Create: `frontend/e2e/support/full-route-matrix.ts`
- Create: `frontend/e2e/support/full-route-matrix.test.ts`

**Interfaces:**
- Produces: `FULL_ROUTE_MATRIX` entries with `path`, `name`, `requiredPermissions`, and `states`.
- Consumed by: responsive, axe, smoke, and screenshot tests.

- [ ] **Step 1: Write failing inventory contract tests**

Assert the matrix contains:

```text
/login, /dashboard, /billing/new, /cashbox, /catalog, /invoices,
/reports, /backups, /settings/fiscal,
/settings/institutional-receipts, /admin/users,
/help, /support, /about, /ruta-no-existente
```

Also require authentication states: forced password change, expired session, and access denied.

- [ ] **Step 2: Verify red**

Run:

```powershell
cd frontend
.\node_modules\.bin\vitest.cmd run e2e/support/full-route-matrix.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
```

Expected: fail because the shared matrix does not exist.

- [ ] **Step 3: Implement and adopt the shared matrix**

Replace duplicated route arrays in accessibility and production-readiness specs. Keep state setup functions in their existing fixtures.

- [ ] **Step 4: Run inventory tests**

Expected: pass with every route represented exactly once by path/state key.

- [ ] **Step 5: Commit**

```powershell
git add frontend/e2e docs/audit/manual-ui/01-route-matrix.md
git commit -m "test(ui): refresh complete route state matrix"
```

### Task 2: Add responsive geometry and reflow assertions

**Files:**
- Create: `frontend/e2e/responsive-all-modules.spec.ts`
- Create: `frontend/e2e/support/geometry-audit.ts`
- Create: `frontend/e2e/support/geometry-audit.test.ts`

**Interfaces:**
- Produces: `auditGeometry(page): {horizontalOverflow, clippedInteractiveElements, undersizedCriticalTargets}`.

- [ ] **Step 1: Write failing geometry helper tests**

Use synthetic DOM fixtures to prove detection of:

- document width larger than viewport;
- visible button/input outside viewport bounds;
- critical icon button smaller than 40×40 CSS pixels;
- allowed horizontal scrolling inside a labeled table container.

- [ ] **Step 2: Verify red**

Run the helper unit test; expect failure because helper is absent.

- [ ] **Step 3: Implement geometry audit**

Ignore hidden/inert elements and printable receipt frames. A table may scroll inside its own container, but the document must not.

- [ ] **Step 4: Implement route matrix test**

Run each canonical route/state at:

```text
320x640, 390x844, 768x1024, 1024x768, 1366x768, 1920x1080
```

Add a Chromium context with `deviceScaleFactor: 1` and CSS zoom/reflow equivalent to 200% at a 1280 CSS-pixel window.

- [ ] **Step 5: Run the matrix and record failures**

Run:

```powershell
.\node_modules\.bin\playwright.cmd test e2e/responsive-all-modules.spec.ts --project=chromium
```

Expected: a concrete list of route/state/viewport failures; no fixes in this step.

- [ ] **Step 6: Commit the audit harness**

```powershell
git add frontend/e2e/responsive-all-modules.spec.ts frontend/e2e/support
git commit -m "test(ui): audit responsive geometry across modules"
```

### Task 3: Fix responsive findings with component tests

**Files:**
- Modify only files named by Task 2 failures under `frontend/src/features`, `frontend/src/shell`, or `frontend/src/components`
- Add/modify colocated `*.test.tsx` files
- Modify: `frontend/src/styles.css` only for a demonstrated cross-module defect

**Interfaces:**
- Consumes: exact failing selectors and viewport evidence from Task 2.
- Produces: zero document overflow and zero clipped critical controls.

- [ ] **Step 1: For each finding, add one failing component test**

Example contract for a wide action row:

```ts
expect(screen.getByRole('group', { name: /acciones/i }))
  .toHaveClass('flex-wrap');
```

Prefer behavior/layout classes and semantic containers; do not snapshot entire pages.

- [ ] **Step 2: Verify each test fails before changing production**

Run only the affected test file. Record the expected missing class/structure.

- [ ] **Step 3: Implement the smallest layout fix**

Allowed patterns include `min-w-0`, `flex-wrap`, responsive grid columns, overflow containers with accessible labels, and drawer/bottom-bar alternatives already used by billing.

- [ ] **Step 4: Run affected component tests and the exact failed Playwright case**

Expected: component test passes and geometry failure is gone without new failures at adjacent viewports.

- [ ] **Step 5: Commit findings by coherent module**

Example:

```powershell
git commit -m "fix(backups): preserve actions at narrow widths"
```

Do not combine unrelated modules in one commit.

### Task 4: Re-run axe, keyboard, focus, and contrast audits

**Files:**
- Modify: `frontend/e2e/accessibility.spec.ts`
- Create: `frontend/e2e/keyboard-focus-all-modules.spec.ts`
- Modify affected components/tests only when a failure is reproduced.

**Interfaces:**
- Produces: zero critical/serious axe violations and deterministic focus checks for dialogs, drawers, menus, and primary workflows.

- [ ] **Step 1: Add failing focus workflow coverage**

Cover:

- login submit/error focus;
- billing patient → search → cart → confirmation → payment;
- cash close dialog cancel/confirm;
- catalog drawer open/close focus restoration;
- backup create/download confirmation;
- maintenance guidance link;
- settings and user dialogs.

- [ ] **Step 2: Run accessibility and focus suites**

Run:

```powershell
.\node_modules\.bin\playwright.cmd test e2e/accessibility.spec.ts e2e/keyboard-focus-all-modules.spec.ts --project=chromium
```

Expected: record exact violations/focus mismatches before fixes.

- [ ] **Step 3: Fix one root cause at a time**

Use semantic labels, descriptions, `aria-live`, focus refs, Radix focus restoration, or token changes. Do not suppress axe rules unless the node has documented manual evidence and the rule cannot evaluate a composed background.

- [ ] **Step 4: Verify affected component tests and full suites**

Expected: zero critical/serious violations, no unclassified incomplete contrast nodes, and all focus checks pass.

- [ ] **Step 5: Commit by root cause**

Use `fix(a11y): ...` Conventional Commit messages.

### Task 5: Certify the critical browser workflows against real Laravel/MariaDB

**Files:**
- Modify: `frontend/e2e/new-invoice-flow.spec.ts`
- Modify: `frontend/e2e/cashbox.spec.ts`
- Modify: `frontend/e2e/backups-flow.spec.ts`
- Modify: `frontend/e2e/catalog-flow.spec.ts`
- Modify: `frontend/e2e/reports-flow.spec.ts`
- Modify: `frontend/scripts/run-release-e2e.mjs`

**Interfaces:**
- Consumes: release API/database and changes from the other three plans.
- Produces: browser evidence for install-ready financial and operational workflows.

- [ ] **Step 1: Add the mixed-basket E2E**

Create/select a L 900 service, add erythropoietin, mark dialysis prescription, and assert before and after emission:

```text
Ordinary line: L 900.00
Erythropoietin: GRATIS
Total: L 900.00 (plus only applicable ISV)
```

Pay, print/reopen receipt, and verify the report shows L 900 collected.

- [ ] **Step 2: Add catalog protection E2E**

Assert a new product form has no editable institutional rule and seeded erythropoietin displays it read-only.

- [ ] **Step 3: Add backup/recovery guidance E2E**

Create a backup, wait for success, download it, and verify recovery guidance points to local maintenance without making a restore API request.

- [ ] **Step 4: Run release E2E**

Run:

```powershell
cd frontend
npm.cmd run test:e2e:release
```

Expected: all release workflows pass against isolated MariaDB.

- [ ] **Step 5: Commit**

```powershell
git add frontend/e2e frontend/scripts/run-release-e2e.mjs
git commit -m "test(release): certify billing backup and catalog workflows"
```

### Task 6: Execute complete quality gates and publish evidence

**Files:**
- Create: `docs/qa/PRODUCTION_READINESS_2026-07-26.md`
- Modify: `docs/refactor-migration/08-responsive-evidence.md`
- Modify: `docs/refactor-migration/10-backup-restore-drill.md`
- Modify: `docs/RELEASE_CHECKLIST.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces: requirement-by-requirement evidence with command, timestamp, exit code, test count, artifact path, and remaining limitation.

- [ ] **Step 1: Verify clean migrations and backend gates**

Run:

```powershell
docker compose up -d
docker compose exec backend php artisan migrate:fresh --seed
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse
```

Expected: every command exits zero.

- [ ] **Step 2: Verify frontend gates**

Run:

```powershell
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run test
docker compose exec frontend npm run build
```

Expected: every command exits zero without warnings treated as errors.

- [ ] **Step 3: Verify scripts, offline package, recovery, and browser**

Run installer self-tests, offline release contract, recovery self-tests/drill, responsive matrix, accessibility/focus suite, and release E2E. Record exact outputs, not “should pass”.

- [ ] **Step 4: Review every design acceptance criterion**

Create a table with columns:

```text
Requirement | Authoritative evidence | Result | Remaining risk
```

No requirement may be marked complete from indirect evidence.

- [ ] **Step 5: Commit release evidence**

```powershell
git add docs/qa/PRODUCTION_READINESS_2026-07-26.md docs/refactor-migration docs/RELEASE_CHECKLIST.md CHANGELOG.md
git commit -m "docs(release): record production readiness evidence"
```

