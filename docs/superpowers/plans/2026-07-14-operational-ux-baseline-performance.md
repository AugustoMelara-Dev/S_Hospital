# Operational UX Baseline and LAN Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an immutable browser/network baseline and make login, setup status, and billing service lookup complete in under two seconds on seeded LAN data without duplicate requests.

**Architecture:** A Playwright audit fixture records geometry, scroll containers, browser errors, requests, timings, and screenshots for the required viewport matrix. Focused Laravel tests and a host-side diagnostic script measure the three critical endpoints; SQL candidate reduction fixes service search before fuzzy matching. React query guards prevent requests that have no user intent.

**Tech Stack:** Playwright 1.61, React 19, TanStack Query 5, Laravel, MySQL/MariaDB, PowerShell.

## Global Constraints

- Preserve React + TypeScript, Ant Design, Ant Design Icons, AG Grid Community, Apache ECharts, React Hook Form + Zod, TanStack Query, Day.js, Laravel + MySQL/MariaDB.
- Production remains fully offline on LAN; add no CDN or mandatory SaaS.
- Preserve existing API, fiscal, authorization, audit, and idempotency contracts.
- Keep global `borderRadius: 0`.
- Do not increase the ten-second API timeout.
- Do not add Compat, Legacy, V1, or temporary adapter wrappers.
- Every changed business rule starts with a failing test.

---

## File Map

- `frontend/e2e/fixtures/operational-ux-audit.ts`: shared geometry, scroll, error, request, and screenshot collector.
- `frontend/e2e/operational-ux-baseline.spec.ts`: required viewport and zoom matrix.
- `frontend/e2e/critical-lan-performance.spec.ts`: real-server timing and duplicate-request assertions.
- `frontend/playwright.real.config.ts`: real-browser project and artifact paths only.
- `scripts/diagnostics/measure-critical-lan.ps1`: repeatable host/LAN HTTP measurement.
- `backend/tests/Feature/CriticalLanPerformanceTest.php`: query-count and response-contract guard.
- `backend/app/Http/Controllers/ServiceController.php`: SQL candidate reduction before fuzzy ranking.
- `frontend/src/hooks/useServices.ts`: billing search enablement and stable query behavior.
- `frontend/src/hooks/useServices.test.tsx`: request-intent tests created in this plan.
- `qa/operational-ux/README.md`: evidence format and immutable before/after policy.

### Task 1: Browser audit fixture

**Files:**
- Create: `frontend/e2e/fixtures/operational-ux-audit.ts`
- Test: `frontend/e2e/operational-ux-baseline.spec.ts`
- Create: `qa/operational-ux/README.md`

**Interfaces:**
- Produces: `observeOperationalPage(page): { capture(options): Promise<OperationalPageAudit> }`.
- Produces: `assertNoDocumentOverflow(audit): void` for later E2E plans.

- [ ] **Step 1: Write the failing smoke test**

```ts
import { expect, test } from '@playwright/test';
import { observeOperationalPage } from './fixtures/operational-ux-audit';

test('records geometry, scroll and browser failures', async ({ page }, testInfo) => {
  const auditObserver = observeOperationalPage(page);
  await page.setContent('<main data-audit-panel="main"><button>Continuar</button></main>');
  const audit = await auditObserver.capture({
    routeName: 'fixture',
    primaryAction: 'Continuar',
    testInfo,
  });
  expect(audit.viewport.width).toBeGreaterThan(0);
  expect(audit.document.horizontalOverflow).toBe(0);
  expect(audit.panels.main.width).toBeGreaterThan(0);
  expect(audit.primaryAction?.visible).toBe(true);
  expect(audit.consoleErrors).toEqual([]);
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `cd frontend; npm.cmd exec playwright test e2e/operational-ux-baseline.spec.ts --project=chromium`

Expected: FAIL with module resolution error for `fixtures/operational-ux-audit`.

- [ ] **Step 3: Implement the audit contract**

```ts
import { expect, type Page, type TestInfo } from '@playwright/test';

export type OperationalPageAudit = {
  viewport: { width: number; height: number };
  document: { scrollWidth: number; clientWidth: number; horizontalOverflow: number };
  panels: Record<string, { x: number; y: number; width: number; height: number }>;
  scrollContainers: Array<{ selector: string; overflowY: string; scrollHeight: number; clientHeight: number }>;
  stickyElements: Array<{ text: string; top: number; bottom: number }>;
  primaryAction: { visible: boolean; covered: boolean } | null;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
};

export function observeOperationalPage(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}`));
  return { capture: async (options: { routeName: string; primaryAction: string; testInfo: TestInfo }): Promise<OperationalPageAudit> => {
    await page.waitForLoadState('networkidle');
    const geometry = await page.evaluate(() => {
    const rect = (element: Element) => {
      const value = element.getBoundingClientRect();
      return { x: value.x, y: value.y, width: value.width, height: value.height };
    };
    const panels = Object.fromEntries(
      [...document.querySelectorAll('[data-audit-panel]')].map((element) => [
        element.getAttribute('data-audit-panel')!,
        rect(element),
      ]),
    );
    const scrollContainers = [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => ({
        element,
        style: getComputedStyle(element),
      }))
      .filter(({ element, style }) => /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1)
      .map(({ element, style }) => ({
        selector: element.id ? `#${element.id}` : element.getAttribute('data-audit-panel') ?? element.tagName.toLowerCase(),
        overflowY: style.overflowY,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));
    const stickyElements = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => getComputedStyle(element).position === 'sticky')
      .map((element) => ({ text: element.innerText.slice(0, 80), top: rect(element).y, bottom: rect(element).y + rect(element).height }));
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      },
      panels,
      scrollContainers,
      stickyElements,
    };
  });
    const primary = page.getByRole('button', { name: options.primaryAction }).or(page.getByRole('link', { name: options.primaryAction })).first();
    const primaryAction = await primary.count() ? {
      visible: await primary.isVisible(),
      covered: await primary.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return hit !== element && !element.contains(hit);
      }),
    } : null;
    const audit = { ...geometry, primaryAction, consoleErrors, pageErrors, failedRequests };
    await options.testInfo.attach(`${options.routeName}-audit`, { body: JSON.stringify(audit, null, 2), contentType: 'application/json' });
    await page.screenshot({ path: options.testInfo.outputPath(`${options.routeName}.png`), fullPage: true });
    return audit;
  } };
}

export function assertNoDocumentOverflow(audit: OperationalPageAudit) {
  expect(audit.document.horizontalOverflow).toBe(0);
}
```

- [ ] **Step 4: Run the fixture test**

Run: `cd frontend; npm.cmd exec playwright test e2e/operational-ux-baseline.spec.ts --project=chromium`

Expected: PASS for the fixture case.

- [ ] **Step 5: Document immutable evidence directories and commit**

Create `qa/operational-ux/README.md` defining `before/`, `after/`, JSON attachment fields, and the canonical twelve routes from the design spec.

Run:

```powershell
git add frontend/e2e/fixtures/operational-ux-audit.ts frontend/e2e/operational-ux-baseline.spec.ts qa/operational-ux/README.md
git commit -m "test(ux): add operational browser audit fixture"
```

### Task 2: Required viewport and zoom baseline

**Files:**
- Modify: `frontend/e2e/operational-ux-baseline.spec.ts`
- Modify: `frontend/playwright.real.config.ts`

**Interfaces:**
- Consumes: `observeOperationalPage` from Task 1.
- Produces: one JSON and PNG attachment per route/viewport/zoom combination.

- [ ] **Step 1: Add the failing matrix test**

```ts
const matrices = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x568', width: 320, height: 568 },
  { name: '1366x768-effective-125', width: 1093, height: 614 },
  { name: '1366x768-effective-200', width: 683, height: 384 },
] as const;

for (const matrix of matrices) {
  test(`captures billing ${matrix.name}`, async ({ page }, testInfo) => {
    const auditObserver = observeOperationalPage(page);
    await page.setViewportSize({ width: matrix.width, height: matrix.height });
    await installNewInvoiceMocks(page);
    await page.goto('/billing/new');
    const audit = await auditObserver.capture({
      routeName: `billing-${matrix.name}`,
      primaryAction: 'Emitir y cobrar',
      testInfo,
    });
    expect(audit.consoleErrors).toEqual([]);
    expect(audit.pageErrors).toEqual([]);
  });
}
```

- [ ] **Step 2: Run and preserve the expected current failures**

Run: `cd frontend; npm.cmd exec playwright test e2e/operational-ux-baseline.spec.ts`

Expected: at least one failure or JSON finding for overflow, covered action, nested scroll, or browser error. Copy artifacts to `qa/operational-ux/before/`; do not update assertions to accept defects.

- [ ] **Step 3: Extend the route matrix**

Add canonical routes `login`, `dashboard`, `billing-empty`, `billing-cart`, `payment-cash`, `receipt-letter`, `invoice-history`, `cash-open`, `cash-close`, `catalog`, `settings-hospital`, and `receipt-settings`. Reuse the strict mock fixtures already defined in the corresponding E2E specs; export those installers instead of copying response payloads.

- [ ] **Step 4: Capture real browser zoom**

At 1366×768 in Chromium, set browser zoom to 125 % and then 200 % using the browser control, reload each canonical route, and capture a screenshot plus audit JSON. The effective-width automated cases exercise reflow but do not replace this real-zoom evidence. Record browser version and zoom value in `qa/operational-ux/before/zoom-review.md`.

- [ ] **Step 5: Run baseline and commit only tests/evidence index**

Run: `cd frontend; npm.cmd exec playwright test e2e/operational-ux-baseline.spec.ts --reporter=list`

Expected: baseline artifacts exist for all matrix entries; defect assertions remain red until their implementation plans execute.

```powershell
git add frontend/e2e/operational-ux-baseline.spec.ts frontend/playwright.real.config.ts qa/operational-ux/before
git commit -m "test(ux): capture defective responsive baseline"
```

### Task 3: Critical endpoint diagnostics

**Files:**
- Create: `backend/tests/Feature/CriticalLanPerformanceTest.php`
- Create: `scripts/diagnostics/measure-critical-lan.ps1`
- Create: `frontend/e2e/critical-lan-performance.spec.ts`

**Interfaces:**
- Produces: a JSON record with `method`, `path`, `status`, `duration_ms`, and request count.

- [ ] **Step 1: Add backend query-contract tests**

```php
<?php

namespace Tests\Feature;

use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CriticalLanPerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_billing_search_does_not_load_the_full_catalog(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('catalog.view');
        Service::factory()->count(1000)->create();
        Service::factory()->create(['name' => 'Glucosa basal', 'active' => true, 'visible_in_billing' => true, 'is_billable' => true]);
        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->getJson('/api/services?billing=1&search=glucosa&per_page=24');

        $response->assertOk()->assertJsonPath('meta.total', 1);
        $queries = collect(DB::getQueryLog());
        $this->assertLessThanOrEqual(4, $queries->count());
        $this->assertTrue($queries->contains(fn (array $query) => str_contains(strtolower($query['query']), 'like')));
    }
}
```

- [ ] **Step 2: Run and verify the full-catalog implementation fails**

Run: `docker compose exec backend php artisan test --filter=CriticalLanPerformanceTest`

Expected: FAIL because the search query has no SQL `LIKE` candidate restriction.

- [ ] **Step 3: Add a repeatable LAN timing script**

```powershell
param(
    [string]$BaseUrl = 'http://127.0.0.1',
    [int]$Iterations = 5,
    [string]$Output = 'qa/operational-ux/critical-lan-timings.json'
)
$targets = @(
    @{ Method = 'GET'; Path = '/api/system/setup-status' },
    @{ Method = 'GET'; Path = '/api/services?billing=1&search=glucosa&per_page=24' }
)
$results = foreach ($target in $targets) {
    foreach ($index in 1..$Iterations) {
        $watch = [Diagnostics.Stopwatch]::StartNew()
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Method $target.Method -Uri ($BaseUrl + $target.Path)
            $status = [int]$response.StatusCode
        } catch {
            $status = [int]$_.Exception.Response.StatusCode
        } finally {
            $watch.Stop()
        }
        [pscustomobject]@{ method = $target.Method; path = $target.Path; iteration = $index; status = $status; duration_ms = $watch.ElapsedMilliseconds }
    }
}
$results | ConvertTo-Json | Set-Content -LiteralPath $Output -Encoding utf8
if ($results.Where({ $_.duration_ms -ge 2000 }).Count -gt 0) { exit 1 }
```

- [ ] **Step 4: Add real-browser duplicate request assertions**

```ts
test('critical requests are unique and below two seconds', async ({ page }) => {
  const started = new Map<object, { path: string; start: number }>();
  const completed: Array<{ path: string; durationMs: number }> = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (['/api/auth/login', '/api/system/setup-status', '/api/services'].includes(path)) {
      started.set(request, { path, start: performance.now() });
    }
  });
  page.on('response', (response) => {
    const timing = started.get(response.request());
    if (timing) completed.push({ path: timing.path, durationMs: performance.now() - timing.start });
  });
  await page.goto('/login');
  await page.getByLabel(/usuario/i).fill(process.env.E2E_LOGIN!);
  await page.getByLabel(/contraseña/i).fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|billing\/new)/);
  await page.waitForLoadState('networkidle');
  expect(completed.filter((request) => request.path === '/api/auth/login')).toHaveLength(1);
  expect(completed.filter((request) => request.path === '/api/system/setup-status')).toHaveLength(1);
  expect(completed.every((request) => request.durationMs < 2000)).toBe(true);
});
```

- [ ] **Step 5: Run diagnostics and commit**

Run:

```powershell
docker compose exec backend php artisan test --filter=CriticalLanPerformanceTest
cd frontend
npm.cmd exec playwright test --config=playwright.real.config.ts e2e/critical-lan-performance.spec.ts
cd ..
powershell -ExecutionPolicy Bypass -File scripts/diagnostics/measure-critical-lan.ps1
```

Expected: backend test remains red only for the candidate-selection defect; the diagnostic JSON identifies any endpoint at or above 2000 ms.

```powershell
git add backend/tests/Feature/CriticalLanPerformanceTest.php scripts/diagnostics/measure-critical-lan.ps1 frontend/e2e/critical-lan-performance.spec.ts
git commit -m "test(performance): measure critical LAN requests"
```

### Task 4: Bound service search and React request intent

**Files:**
- Modify: `backend/app/Http/Controllers/ServiceController.php`
- Modify: `backend/tests/Feature/CriticalLanPerformanceTest.php`
- Modify: `backend/tests/Feature/ServiceCatalogTest.php`
- Modify: `frontend/src/hooks/useServices.ts`
- Create: `frontend/src/hooks/useServices.test.tsx`
- Modify: `frontend/src/lib/api/catalog.ts`
- Modify: `frontend/src/lib/api/catalog.test.ts`

**Interfaces:**
- Produces unchanged `GET /api/services` JSON contract.
- Produces `useServices(filters, { enabled? })` with no request until billing has search, code, or explicit filters.

- [ ] **Step 1: Add matching guards for aliases and names**

Extend `CriticalLanPerformanceTest` with exact cases for name prefix, alias match, scan code, category filter, and no result. Assert pagination metadata remains unchanged.

- [ ] **Step 2: Implement SQL candidate reduction**

```php
$search = trim($request->string('search')->toString());
$tokens = collect(preg_split('/\s+/u', $search, -1, PREG_SPLIT_NO_EMPTY))->take(4);

if ($tokens->isNotEmpty()) {
    $query->where(function ($candidateQuery) use ($tokens): void {
        foreach ($tokens as $token) {
            $escaped = addcslashes($token, '%_\\');
            $candidateQuery->where(function ($tokenQuery) use ($escaped): void {
                $tokenQuery
                    ->where('name', 'like', "%{$escaped}%")
                    ->orWhere('aliases', 'like', "%{$escaped}%")
                    ->orWhere('internal_code', 'like', "%{$escaped}%");
            });
        }
    });
}

$services = $request->filled('search')
    ? $this->fuzzySearch($query->get(), $search, $request)
    : $query->paginate($request->perPage());
```

Keep `ServiceSearch::matches` as the final ranking/matching rule over the bounded candidates.

- [ ] **Step 3: Run backend tests**

Run: `docker compose exec backend php artisan test --filter='CriticalLanPerformanceTest|ServiceCatalogTest'`

Expected: PASS, unchanged response contract, and no full catalog fetch.

- [ ] **Step 4: Add the failing hook test**

```tsx
it('does not request billing services without user intent', async () => {
  const getServicesPage = vi.spyOn(apiClient, 'getServicesPage').mockResolvedValue({ data: [], meta: emptyMeta });
  renderHook(() => useServices({ billing: true }), { wrapper });
  await waitFor(() => expect(getServicesPage).not.toHaveBeenCalled());
});
```

- [ ] **Step 5: Implement stable enablement**

```ts
export function useServices(filters: ServiceFilters = {}, options: { enabled?: boolean } = {}) {
  const hasIntent = Boolean(filters.search?.trim() || filters.code || filters.categoryId || filters.areaId || !filters.billing);
  return useQuery({
    queryKey: queryKeys.services.list(filters),
    queryFn: ({ signal }) => apiClient.getServicesPage(filters, { signal }),
    placeholderData: (previousData) => previousData,
    enabled: options.enabled ?? hasIntent,
  });
}
```

Update `getServicesPage` only if its existing signature lacks `AbortSignal`; define the option as `{ signal?: AbortSignal }` in `frontend/src/lib/api/catalog.ts` and forward it to the base client.

```ts
async getServicesPage(
  filters: ServiceFilters = {},
  options: { signal?: AbortSignal } = {},
): Promise<{ data: Service[]; meta: PaginatedMeta }>

const response = await apiClient.request<{ data: Service[]; meta?: PaginatedMeta }>(
  `/api/services${query}`,
  { signal: options.signal },
);
```

Keep the existing URLSearchParams construction and fallback metadata return unchanged around these two edits; add focused unit cases for search, code, billing, category, area, page, and aborted request.

- [ ] **Step 6: Run frontend tests and critical timing**

Run:

```powershell
cd frontend
npm.cmd exec vitest run src/hooks/useServices.test.tsx src/lib/api/catalog.test.ts
npm.cmd run typecheck
cd ..
powershell -ExecutionPolicy Bypass -File scripts/diagnostics/measure-critical-lan.ps1
```

Expected: PASS; every recorded critical request is below 2000 ms.

- [ ] **Step 7: Commit**

```powershell
git add backend/app/Http/Controllers/ServiceController.php backend/tests/Feature/CriticalLanPerformanceTest.php backend/tests/Feature/ServiceCatalogTest.php frontend/src/hooks/useServices.ts frontend/src/hooks/useServices.test.tsx frontend/src/lib/api/catalog.ts frontend/src/lib/api/catalog.test.ts
git commit -m "fix(performance): bound billing service search"
```

### Task 5: Baseline phase gate

**Files:**
- Modify: `qa/operational-ux/README.md`
- Create: `qa/operational-ux/baseline-report.md`

- [ ] **Step 1: Execute the focused gate**

```powershell
docker compose exec backend php artisan test --filter='CriticalLanPerformanceTest|AuthTest|SystemStatusTest|ServiceCatalogTest'
docker compose exec backend vendor/bin/pint --test
cd frontend
npm.cmd exec vitest run src/hooks/useServices.test.tsx src/lib/api/catalog.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd exec playwright test e2e/operational-ux-baseline.spec.ts e2e/critical-lan-performance.spec.ts
```

Expected: unit/feature/type/lint/build pass. Baseline defect assertions may remain red only when assigned to a later implementation plan and must be itemized in the report.

- [ ] **Step 2: Write the evidence report**

Record exact command, exit code, endpoint p50/max, duplicate counts, paths to JSON/PNG, and every red visual criterion assigned to Plans 2–5. Do not call the UI corrected.

- [ ] **Step 3: Commit**

```powershell
git add qa/operational-ux
git commit -m "docs(qa): record operational UX baseline"
```
