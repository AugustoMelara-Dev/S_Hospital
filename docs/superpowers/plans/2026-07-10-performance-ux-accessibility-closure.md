# S_Hospital Performance, UX and Accessibility Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que S_Hospital responda más rápido y requiera menos esfuerzo operativo sin reabrir los dominios de dinero, fiscalidad, auditoría o impresión ya cerrados.

**Architecture:** Se mantiene React 19, Laravel, MariaDB, Tailwind 4 y los contratos API actuales. El cierre combina carga diferida con precarga por intención, cancelación de búsquedas, reducción visual de duplicaciones, un canal de retroalimentación operativo y presupuestos automatizados. El backend limita candidatos de catálogo en SQL antes de aplicar fuzzy matching.

**Tech Stack:** React 19, TypeScript estricto, React Router 7, TanStack Query 5, Tailwind CSS 4, Laravel, MySQL/MariaDB, Vitest, Testing Library, Playwright y axe-core.

## Global Constraints

- Producción debe operar sin internet y sin fuentes, CDNs o servicios SaaS.
- No agregar dependencias salvo evidencia medible de que la plataforma actual no resuelve el problema.
- El backend sigue siendo fuente de verdad para dinero, impuestos, permisos, estados y numeración.
- El usuario solo elige Carta, Media carta o A5; no aparecen márgenes, medidas, fuente ni escala.
- No borrar facturas, pagos, recibos, cierres ni auditorías.
- No agregar módulos clínicos ni contabilidad de partida doble.
- Cada tarea usa TDD y termina en un commit Conventional Commit.
- Usar la suite relacionada durante el desarrollo y el gate completo una sola vez en la Task 10.
- Especificación fuente: `docs/superpowers/specs/2026-07-10-performance-ux-accessibility-closure-design.md`.

---

### Task 1: Escalera de verificación rápida

**Files:**
- Create: `scripts/verify_changed.ps1`
- Create: `scripts/verify_changed.test.ps1`
- Modify: `frontend/package.json`
- Modify: `README.md`
- Modify: `docs/testing-report.md`

**Interfaces:**
- Consumes: paths devueltos por `git diff --name-only` y scopes `Changed`, `Billing`, `Shell`, `Reports`, `Admin`, `Release`.
- Produces: `scripts/verify_changed.ps1 -Scope <scope>` con salida por pasos y propagación del primer exit code distinto de cero.

- [ ] **Step 1: Escribir el contrato rojo del runner**

```powershell
$content = Get-Content "$PSScriptRoot/verify_changed.ps1" -Raw
foreach ($required in @(
    '[ValidateSet("Changed", "Billing", "Shell", "Reports", "Admin", "Release")]',
    'vitest related --run',
    'npm run typecheck',
    'npm run build',
    'php artisan test',
    'playwright test'
)) {
    if (-not $content.Contains($required)) { throw "Falta contrato: $required" }
}
```

- [ ] **Step 2: Ejecutar el contrato y comprobar el fallo**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify_changed.test.ps1`

Expected: FAIL porque `scripts/verify_changed.ps1` aún no existe.

- [ ] **Step 3: Implementar el runner con scopes cerrados**

```powershell
param(
    [ValidateSet("Changed", "Billing", "Shell", "Reports", "Admin", "Release")]
    [string] $Scope = "Changed"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Invoke-Step([string] $Name, [scriptblock] $Command) {
    Write-Host "[RUN] $Name"
    & $Command
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$moduleTests = @{
    Billing = @("NewInvoiceView", "PatientStep", "ServiceSearch", "InvoiceCart", "PaymentModal")
    Shell   = @("AppRoutes", "AppShell", "Sidebar", "DashboardView", "toaster")
    Reports = @("ReportsView", "ReportsExecutive", "InvoiceHistoryView")
    Admin   = @("UsersView", "BackupsView", "InstitutionalReceiptSettingsView")
}
```

`Changed` ejecutará ESLint sobre los `.ts/.tsx` modificados y `vitest related --run` sobre esos paths. Los scopes de módulo ejecutarán solo los patrones del mapa, luego typecheck. `Release` ejecutará los comandos completos de Task 10 y no se usará durante ajustes individuales.

- [ ] **Step 4: Agregar scripts npm explícitos**

```json
{
  "verify:billing": "vitest run NewInvoiceView PatientStep ServiceSearch InvoiceCart PaymentModal --pool=forks --maxWorkers=2 --no-file-parallelism",
  "verify:shell": "vitest run AppRoutes AppShell Sidebar DashboardView toaster --pool=forks --maxWorkers=2 --no-file-parallelism",
  "verify:reports": "vitest run ReportsView ReportsExecutive InvoiceHistoryView --pool=forks --maxWorkers=2 --no-file-parallelism"
}
```

- [ ] **Step 5: Ejecutar los scopes rápidos**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify_changed.test.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify_changed.ps1 -Scope Changed
```

Expected: PASS; ningún comando de cobertura completa o matriz multiviewport debe aparecer en `Changed`.

- [ ] **Step 6: Documentar tiempos y regla de uso**

Añadir a `README.md`: `Changed` por edición, módulo antes de commit, `Release` una vez al final. Añadir a `docs/testing-report.md` la duración observada de cada scope.

- [ ] **Step 7: Commit**

```powershell
git add scripts/verify_changed.ps1 scripts/verify_changed.test.ps1 frontend/package.json README.md docs/testing-report.md
git commit -m "chore(test): add risk-based verification ladder"
```

### Task 2: Presupuestos reproducibles de rendimiento

**Files:**
- Create: `frontend/scripts/check-bundle-budget.mjs`
- Create: `frontend/scripts/check-bundle-budget.test.mjs`
- Create: `frontend/e2e/performance-budget.spec.ts`
- Create: `frontend/playwright.performance.config.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`

**Interfaces:**
- Consumes: archivos de `frontend/dist/assets` y Performance Timeline de Chromium sobre `vite preview`.
- Produces: `npm run performance:budget` con límites de bundle, LCP <= 1800 ms, CLS <= 0.10 e interacción <= 200 ms.

- [ ] **Step 1: Escribir pruebas rojas para clasificación de chunks**

```js
import { strict as assert } from 'node:assert';
import { classifyAsset, BUDGETS } from './check-bundle-budget.mjs';

assert.equal(classifyAsset('index-AbC.js'), 'entry');
assert.equal(classifyAsset('vendor-AbC.js'), 'vendor');
assert.equal(classifyAsset('charts-AbC.js'), 'charts');
assert.deepEqual(BUDGETS, {
  entry: 70 * 1024,
  vendor: 125 * 1024,
  ui: 52 * 1024,
  charts: 110 * 1024,
  css: 18 * 1024,
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node frontend/scripts/check-bundle-budget.test.mjs`

Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar el verificador con gzip real**

```js
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const BUDGETS = {
  entry: 70 * 1024,
  vendor: 125 * 1024,
  ui: 52 * 1024,
  charts: 110 * 1024,
  css: 18 * 1024,
};

export function classifyAsset(name) {
  if (name.endsWith('.css')) return 'css';
  for (const key of ['vendor', 'ui', 'charts']) {
    if (name.startsWith(`${key}-`)) return key;
  }
  return name.startsWith('index-') ? 'entry' : null;
}
```

El script comprimirá cada archivo, comparará bytes con `BUDGETS`, imprimirá tabla y saldrá 1 si excede un límite.

- [ ] **Step 4: Crear el gate de navegador sobre build productivo**

```ts
test('login and dashboard stay inside the LAN interaction budget', async ({ page }) => {
  await page.addInitScript(() => {
    const metrics = { lcp: 0, cls: 0, interaction: 0 };
    Object.assign(window, { __hospitalMetrics: metrics });
    new PerformanceObserver((list) => {
      metrics.lcp = Math.max(metrics.lcp, ...list.getEntries().map((entry) => entry.startTime));
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!entry.hadRecentInput) metrics.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      metrics.interaction = Math.max(metrics.interaction, ...list.getEntries().map((entry) => entry.duration));
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  });
  await page.goto('/login');
  await page.getByLabel(/usuario o correo/i).focus();
  const metrics = await page.evaluate(() => (
    window as Window & { __hospitalMetrics: { lcp: number; cls: number; interaction: number } }
  ).__hospitalMetrics);
  expect(metrics.lcp).toBeLessThanOrEqual(1800);
  expect(metrics.cls).toBeLessThanOrEqual(0.1);
  expect(metrics.interaction).toBeLessThanOrEqual(200);
});
```

La configuración usará `npm run preview -- --host 127.0.0.1 --port 4180 --strictPort`, un contexto limpio y CDP con CPU 4x, throughput 20 Mbps y latencia 20 ms.

- [ ] **Step 5: Agregar comandos**

```json
{
  "preview": "vite preview",
  "performance:bundle": "node scripts/check-bundle-budget.mjs",
  "performance:browser": "playwright test --config=playwright.performance.config.ts",
  "performance:budget": "npm run build && npm run performance:bundle && npm run performance:browser"
}
```

- [ ] **Step 6: Ejecutar presupuesto inicial**

Run: `npm run performance:budget`

Expected: el gate identifica de forma exacta cualquier chunk o métrica fuera del presupuesto; guardar cifras en `docs/testing-report.md` sin suavizar fallos.

- [ ] **Step 7: Commit**

```powershell
git add frontend/scripts frontend/e2e/performance-budget.spec.ts frontend/playwright.performance.config.ts frontend/package.json frontend/vite.config.ts docs/testing-report.md
git commit -m "test(performance): enforce frontend response budgets"
```

### Task 3: Carga diferida y precarga por intención

**Files:**
- Create: `frontend/src/app/routePreloaders.ts`
- Create: `frontend/src/app/routePreloaders.test.ts`
- Create: `frontend/src/lib/realtime/BroadcastSyncBridge.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/AppRoutes.tsx`
- Modify: `frontend/src/layout/AppShell.tsx`
- Modify: `frontend/src/layout/components/SidebarNavItem.tsx`
- Modify: `frontend/src/features/dashboard/DashboardView.tsx`

**Interfaces:**
- Produces: `createRoutePreloader(loaders)` para pruebas, `preloadRouteModule(path: string): Promise<void>` y `routeModuleLoaders` usados por `React.lazy`.
- Produces: `BroadcastSyncBridge` sin UI, montado después del primer render.

- [ ] **Step 1: Escribir pruebas rojas de deduplicación y rutas**

```ts
it('deduplicates preload calls for the billing route', async () => {
  const loader = vi.fn().mockResolvedValue({ NewInvoiceView: () => null });
  const preload = createRoutePreloader({ '/billing/new': loader });
  await Promise.all([preload('/billing/new'), preload('/billing/new')]);
  expect(loader).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Ejecutar prueba roja**

Run: `npm run test -- routePreloaders`

Expected: FAIL porque la interfaz no existe.

- [ ] **Step 3: Implementar catálogo único de loaders**

```ts
export const routeModuleLoaders = {
  dashboard: () => import('../features/dashboard/DashboardView'),
  billing: () => import('../features/invoices/NewInvoiceView'),
  cashbox: () => import('../features/cash/CashBoxView'),
  catalog: () => import('../features/catalog/CatalogView'),
  invoices: () => import('../features/invoices/InvoiceHistoryView'),
  reports: () => import('../features/reports/ReportsView'),
} as const;

const routeLoaderByPath: Record<string, () => Promise<unknown>> = {
  '/dashboard': routeModuleLoaders.dashboard,
  '/billing/new': routeModuleLoaders.billing,
  '/cashbox': routeModuleLoaders.cashbox,
  '/catalog': routeModuleLoaders.catalog,
  '/invoices': routeModuleLoaders.invoices,
  '/reports': routeModuleLoaders.reports,
};

export function createRoutePreloader(loaders: Record<string, () => Promise<unknown>>) {
  const promises = new Map<string, Promise<unknown>>();
  return async (path: string): Promise<void> => {
    const key = path.startsWith('/reports') ? '/reports' : path;
    const loader = loaders[key];
    if (!loader) return;
    const promise = promises.get(key) ?? loader();
    promises.set(key, promise);
    await promise;
  };
}

export const preloadRouteModule = createRoutePreloader(routeLoaderByPath);
```

- [ ] **Step 4: Hacer lazy Nueva factura, Caja y diálogo rápido**

`AppRoutes.tsx` y `App.tsx` deben usar los mismos loaders. Eliminar imports eager de `NewInvoiceView` y `CashBoxView`. Cada ruta conservará su `PermissionGate` y tendrá un `LoadingState` con nombre del módulo.

- [ ] **Step 5: Precargar al expresar intención**

```tsx
<NavLink
  onFocus={() => void preloadRouteModule(item.path)}
  onPointerEnter={() => void preloadRouteModule(item.path)}
  onTouchStart={() => void preloadRouteModule(item.path)}
  to={item.path}
>
```

El CTA de Dashboard ejecutará las mismas señales. Tras login, `App.tsx` precargará `/billing/new` para cajero y `/dashboard` para los demás roles mediante `requestIdleCallback` con fallback de 600 ms.

- [ ] **Step 6: Diferir onboarding, atajos y WebSocket**

Mover `useBroadcastSync()` a `BroadcastSyncBridge`. `AppShell` montará el bridge en `requestIdleCallback`; `GuidedTour` y `KeyboardShortcutsPalette` serán imports lazy y solo se renderizarán al abrirse.

- [ ] **Step 7: Ejecutar gates de módulo y presupuesto**

Run:

```powershell
powershell -File scripts/verify_changed.ps1 -Scope Shell
Set-Location frontend
npm run performance:budget
```

Expected: navegación y presupuesto PASS; `charts`, `pusher-js` y módulos administrativos no aparecen en la carga inicial de login.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/app/routePreloaders* frontend/src/App.tsx frontend/src/AppRoutes.tsx frontend/src/layout frontend/src/lib/realtime frontend/src/features/dashboard/DashboardView.tsx
git commit -m "perf(frontend): preload operational routes on intent"
```

### Task 4: Búsqueda de servicios rápida y sin carreras

**Files:**
- Modify: `frontend/src/lib/api/base.ts`
- Modify: `frontend/src/lib/api/catalog.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/features/invoices/hooks/useServiceSearchRequest.ts`
- Create: `frontend/src/features/invoices/hooks/useServiceSearchRequest.test.tsx`
- Modify: `frontend/src/features/invoices/NewInvoiceView.tsx`
- Modify: `frontend/src/features/invoices/components/ServiceSearch.tsx`
- Modify: `frontend/src/features/invoices/NewInvoiceView.test.tsx`

**Interfaces:**
- Produces: `getServices(filters, options?: { signal?: AbortSignal }): Promise<Service[]>`.
- Produces: `useServiceSearchRequest()` con `search(filters)` y `cancel()`; solo la respuesta vigente actualiza resultados.

- [ ] **Step 1: Escribir la prueba roja de cancelación**

```ts
it('aborts the previous service request and keeps the latest result', async () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((next) => { resolve = next; });
    return { promise, resolve };
  }
  const first = deferred<Service[]>();
  const second = deferred<Service[]>();
  mockedGetServices.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result } = renderHook(() => useServiceSearchRequest());
  act(() => void result.current.search({ search: 'eri' }));
  act(() => void result.current.search({ search: 'glucosa' }));
  second.resolve([glucoseService]);
  await waitFor(() => expect(result.current.services).toEqual([glucoseService]));
  first.resolve([erythropoietinService]);
  expect(result.current.services).toEqual([glucoseService]);
});
```

- [ ] **Step 2: Verificar fallo**

Run: `npm run test -- useServiceSearchRequest`

Expected: FAIL por hook inexistente.

- [ ] **Step 3: Propagar `AbortSignal` hasta fetch**

```ts
export type ApiCallOptions = { signal?: AbortSignal };

async getServicesPage(
  filters: ServiceFilters = {},
  options: ApiCallOptions = {},
): Promise<{ data: Service[]; meta: PaginatedMeta }> {
  const response = await apiClient.request<{ data: Service[]; meta?: PaginatedMeta }>(
    `/api/services${query}`,
    { signal: options.signal },
  );
  return {
    data: response.data,
    meta: response.meta ?? { current_page: 1, per_page: response.data.length, total: response.data.length },
  };
}
```

`apiClient.request` combinará `signal` con sus opciones existentes sin alterar CSRF, timeout ni manejo de errores.

- [ ] **Step 4: Implementar hook con secuencia vigente**

```ts
const controllerRef = useRef<AbortController | null>(null);
const sequenceRef = useRef(0);

const search = useCallback(async (filters: ServiceFilters) => {
  controllerRef.current?.abort();
  const controller = new AbortController();
  const sequence = ++sequenceRef.current;
  controllerRef.current = controller;
  const services = await apiClient.getServices(filters, { signal: controller.signal });
  if (sequence === sequenceRef.current) setServices(services);
}, []);
```

- [ ] **Step 5: Eliminar carga inicial de 24 servicios invisibles**

`loadPointOfSaleData()` cargará caja, categorías y áreas. La búsqueda se activa con dos caracteres, un área/categoría específica o Enter. Mantener debounce en 200 ms. `ServiceSearch` mostrará `Escriba al menos 2 caracteres o seleccione un filtro` cuando no hay intención.

- [ ] **Step 6: Probar teclado, carga y error**

Run:

```powershell
powershell -File scripts/verify_changed.ps1 -Scope Billing
Set-Location frontend
npx playwright test e2e/new-invoice-flow.spec.ts --workers=1
```

Expected: PASS; una búsqueda rápida no muestra resultados de una solicitud anterior y Enter agrega el primer resultado vigente.

- [ ] **Step 7: Commit**

```powershell
git add frontend/src/lib/api frontend/src/lib/api.ts frontend/src/features/invoices
git commit -m "perf(billing): cancel stale service searches"
```

### Task 5: Simplificar el punto de venta y su retroalimentación

**Files:**
- Modify: `frontend/src/features/invoices/components/PatientStep.tsx`
- Modify: `frontend/src/features/invoices/components/PatientStep.test.tsx`
- Modify: `frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx`
- Modify: `frontend/src/features/invoices/components/NewInvoiceViewLayout.test.tsx`
- Modify: `frontend/src/features/invoices/components/InvoiceCart.tsx`
- Modify: `frontend/src/components/ui/toaster.tsx`
- Modify: `frontend/src/components/ui/toaster.test.tsx`
- Create: `frontend/src/app/operationalFeedback.ts`
- Create: `frontend/src/app/operationalFeedback.test.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Produces: `classifyOperationalFeedback(message): 'progress' | 'success' | 'warning' | 'error'`.
- Mantiene props públicas de `PatientStep`, `InvoiceCart` y `NewInvoiceViewLayout` para no expandir el cambio.

- [ ] **Step 1: Escribir pruebas rojas del paciente compacto**

```tsx
render(<PatientStep patientName="Maria Lopez" onPatientNameChange={vi.fn()} />);
expect(screen.getByLabelText(/nombre del paciente/i)).toHaveValue('Maria Lopez');
expect(screen.queryByText('Capturado')).not.toBeInTheDocument();
expect(screen.queryByText(/Paciente: Maria Lopez/i)).not.toBeInTheDocument();
expect(screen.queryByText(/Dato requerido/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Ejecutar y observar el fallo esperado**

Run: `npm run test -- PatientStep NewInvoiceViewLayout toaster operationalFeedback`

Expected: FAIL porque la UI actual contiene tres confirmaciones redundantes y admite dos toasts.

- [ ] **Step 3: Reducir `PatientStep` a una decisión**

Conservar título, ayuda breve, input y error. Mover el contador a texto inline solo cuando queden 20 caracteres. Eliminar badge `Capturado`, caja `Dato requerido` y repetición `Paciente: ...`.

- [ ] **Step 4: Eliminar triple estado de caja en Nueva factura**

Mantener `OperationalBanner` con un único badge. Eliminar `CashStatusCard`. Si caja está cerrada, el alert conserva `Abrir caja`; si está abierta, no se muestra otro panel de caja.

- [ ] **Step 5: Mantener CTA visible sin tapar contenido**

En escritorio, el carrito será `lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)]`. En móvil, `Emitir y cobrar` permanecerá dentro del flujo, después del resumen; no se crea barra flotante.

- [ ] **Step 6: Unificar feedback y limitar a un toast**

```ts
export function classifyOperationalFeedback(message: string): FeedbackKind {
  if (/^(Cargando|Consultando|Preparando|Validando|Guardando|Abriendo|Cerrando)/.test(message)) return 'progress';
  if (isErrorMessage(message)) return 'error';
  if (/pendiente|diferencia|revise/i.test(message)) return 'warning';
  return 'success';
}
```

Cambiar `MAX_VISIBLE_TOASTS` a 1. Todos los estados operativos usarán ID `operational-feedback`; el mensaje nuevo reemplaza el anterior. `progress` no crea toast.

- [ ] **Step 7: Ejecutar UX E2E enfocado**

Run:

```powershell
powershell -File scripts/verify_changed.ps1 -Scope Billing
Set-Location frontend
npx playwright test e2e/new-invoice-flow.spec.ts e2e/production-readiness.spec.ts --grep "cashier" --workers=1
```

Expected: PASS; ningún screenshot muestra dos toasts, tres estados de caja o repetición del nombre del paciente.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/features/invoices/components frontend/src/components/ui/toaster* frontend/src/app/operationalFeedback* frontend/src/App.tsx
git commit -m "refactor(billing): reduce point-of-sale cognitive load"
```

### Task 6: Shell e Inicio sin información duplicada

**Files:**
- Modify: `frontend/src/layout/Sidebar.tsx`
- Modify: `frontend/src/layout/Sidebar.test.tsx`
- Modify: `frontend/src/layout/Topbar.tsx`
- Modify: `frontend/src/features/dashboard/DashboardView.tsx`
- Modify: `frontend/src/features/dashboard/DashboardView.test.tsx`
- Create: `frontend/src/lib/statusLabels.ts`
- Create: `frontend/src/lib/statusLabels.test.ts`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Produces: `invoiceStatusLabel(status: Invoice['status']): string` y equivalentes para pago/caja.
- Topbar queda como único estado global persistente de conexión y caja.

- [ ] **Step 1: Escribir pruebas rojas de duplicación e idioma**

```tsx
renderSidebar({ cashSession: openSession });
expect(screen.queryByText('Caja #7')).not.toBeInTheDocument();

renderDashboard({ invoice: { ...invoice, status: 'paid' } });
expect(screen.getByRole('cell', { name: 'Pagada' })).toBeVisible();
expect(screen.queryByText('paid')).not.toBeInTheDocument();
```

- [ ] **Step 2: Ejecutar pruebas rojas**

Run: `npm run test -- Sidebar DashboardView statusLabels`

Expected: FAIL porque sidebar repite caja y Dashboard imprime el estado crudo.

- [ ] **Step 3: Eliminar tarjeta fija de caja del sidebar**

Retirar el bloque `data-slot="sidebar-cash-status"` y el import `Banknote`. Mantener caja en Topbar y la tarjeta contextual de Dashboard. El sidebar contendrá marca, navegación, usuario y estado local.

- [ ] **Step 4: Centralizar etiquetas en español**

```ts
const invoiceStatusLabels = {
  issued: 'Emitida',
  paid: 'Pagada',
  partial: 'Parcial',
  void: 'Anulada',
} as const;

export function invoiceStatusLabel(status: keyof typeof invoiceStatusLabels): string {
  return invoiceStatusLabels[status];
}
```

Usar el formateador en Dashboard, Historial y reportes donde aparezca un valor crudo.

- [ ] **Step 5: Simplificar encabezado de Inicio**

Cambiar `Centro de mando` a `Inicio`, eliminar la frase `Una acción clara`, mantener CTA primaria y resumen. Las cuatro métricas permanecen porque responden caja, facturado, cobrado y pendiente.

- [ ] **Step 6: Reducir mayúsculas decorativas**

Limitar tracking `[0.16em]` a marca y secciones de navegación. Labels de formularios y paneles usarán sentence case con `tracking-normal`, sin cambiar tamaño de objetivos táctiles.

- [ ] **Step 7: Verificar shell y presupuesto**

Run:

```powershell
powershell -File scripts/verify_changed.ps1 -Scope Shell
Set-Location frontend
npm run performance:budget
```

Expected: PASS; caja aparece una vez en shell, todos los estados visibles están en español.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/layout frontend/src/features/dashboard frontend/src/lib/statusLabels* frontend/src/styles.css
git commit -m "refactor(shell): remove duplicate operational status"
```

### Task 7: Densidad útil en Reportes, Historial y Usuarios

**Files:**
- Modify: `frontend/src/features/reports/ReportsExecutive.tsx`
- Modify: `frontend/src/features/reports/ReportsExecutive.test.tsx`
- Modify: `frontend/src/features/invoices/history/InvoiceHistoryFilters.tsx`
- Modify: `frontend/src/features/invoices/InvoiceHistoryView.test.tsx`
- Modify: `frontend/src/features/admin/components/UserFormDialog.tsx`
- Modify: `frontend/src/features/admin/components/UserFormDialog.test.tsx`
- Modify: `frontend/src/components/ui/filter-bar.tsx`

**Interfaces:**
- Reutiliza `FilterBar` y `ActionMenu`; no crea un cuarto patrón de navegación ni una dependencia.
- Produce un filtro principal visible y detalles bajo revelado progresivo.

- [ ] **Step 1: Escribir pruebas rojas de jerarquía de acciones**

```tsx
expect(screen.getByRole('button', { name: 'Actualizar' })).toBeVisible();
expect(screen.getByRole('button', { name: 'Exportar' })).toBeVisible();
expect(screen.queryByRole('button', { name: /PDF ejecutivo/i })).not.toBeInTheDocument();
expect(screen.queryByRole('button', { name: /Excel ejecutivo/i })).not.toBeInTheDocument();
```

Historial debe mostrar Número y Paciente; Fecha, Estado, Caja y Usuario solo después de `Más filtros`. Usuarios debe mantener `Permisos exactos avanzados` cerrado al abrir.

- [ ] **Step 2: Ejecutar tests rojos**

Run: `npm run test -- ReportsExecutive InvoiceHistoryView UserFormDialog`

Expected: FAIL por tres acciones de reporte visibles y filtros históricos expandidos.

- [ ] **Step 3: Consolidar reportes**

Renombrar `Refrescar ejecutivo` a `Actualizar`. Reemplazar botones PDF/Excel por `ActionMenu` `Exportar` con dos items. Mantener filtros de período en una fila y el texto de máximo 31 días como ayuda, no como tarjeta.

- [ ] **Step 4: Aplicar revelado progresivo a Historial**

`InvoiceHistoryFilters` conservará Número, Paciente y Buscar. Un botón `Más filtros` controlará un panel con fecha, estado, caja y usuario, con `aria-expanded` y `aria-controls`. Si un filtro avanzado está activo, el panel inicia abierto.

- [ ] **Step 5: Mantener permisos avanzados cerrados**

`UserFormDialog` seguirá seleccionando rol primero. El detalle de permisos directos solo se renderiza al activar `Permisos exactos avanzados`; la prueba verificará que el catálogo no está en el árbol accesible antes de expandir.

- [ ] **Step 6: Ejecutar E2E de rutas**

Run:

```powershell
powershell -File scripts/verify_changed.ps1 -Scope Reports
powershell -File scripts/verify_changed.ps1 -Scope Admin
Set-Location frontend
npx playwright test e2e/reports-flow.spec.ts e2e/invoice-history-flow.spec.ts e2e/users-flow.spec.ts --workers=1
```

Expected: PASS; exportaciones conservan permisos y payloads, filtros avanzados no desaparecen y usuarios no pierde permisos seleccionados.

- [ ] **Step 7: Commit**

```powershell
git add frontend/src/features/reports frontend/src/features/invoices/history frontend/src/features/invoices/InvoiceHistoryView.test.tsx frontend/src/features/admin/components/UserFormDialog* frontend/src/components/ui/filter-bar.tsx
git commit -m "refactor(ux): prioritize primary operational actions"
```

### Task 8: WCAG 2.2 y flujo completo por teclado

**Files:**
- Create: `frontend/src/components/ui/form-error-summary.tsx`
- Create: `frontend/src/components/ui/form-error-summary.test.tsx`
- Modify: `frontend/src/features/invoices/components/PaymentModal.tsx`
- Modify: `frontend/src/features/cash/components/CloseSessionDialog.tsx`
- Modify: `frontend/src/features/admin/components/UserFormDialog.tsx`
- Modify: `frontend/src/components/ui/button.tsx`
- Create: `frontend/e2e/keyboard-critical-flow.spec.ts`
- Create: `frontend/e2e/zoom-reflow.spec.ts`
- Modify: `frontend/e2e/accessibility.spec.ts`
- Create: `docs/accessibility-manual-checklist.md`

**Interfaces:**
- Produces: `<FormErrorSummary title errors focusRef />` con links a IDs de campos.
- Produce E2E de abrir caja, facturar, cobrar, cerrar diálogo e imprimir usando solo teclado.

- [ ] **Step 1: Escribir pruebas rojas del resumen de errores**

```tsx
render(<FormErrorSummary title="Revise el pago" errors={[
  { fieldId: 'payment-amount', message: 'Ingrese un monto válido.' },
]} />);
expect(screen.getByRole('alert', { name: 'Revise el pago' })).toBeVisible();
await user.click(screen.getByRole('link', { name: 'Ingrese un monto válido.' }));
expect(screen.getByLabelText(/monto recibido/i)).toHaveFocus();
```

- [ ] **Step 2: Ejecutar prueba roja**

Run: `npm run test -- form-error-summary PaymentModal CloseSessionDialog UserFormDialog`

Expected: FAIL por componente inexistente.

- [ ] **Step 3: Implementar resumen y foco**

```tsx
export function FormErrorSummary({ title, errors }: Props) {
  if (errors.length === 0) return null;
  return (
    <section role="alert" aria-labelledby="form-error-title" tabIndex={-1}>
      <h3 id="form-error-title">{title}</h3>
      <ul>{errors.map((error) => (
        <li key={error.fieldId}>
          <a
            href={`#${error.fieldId}`}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(error.fieldId)?.focus();
            }}
          >
            {error.message}
          </a>
        </li>
      ))}</ul>
    </section>
  );
}
```

Al submit inválido, enfocar el resumen; al pulsar un error, enfocar el campo. Radix conserva restauración al trigger.

- [ ] **Step 4: Asegurar tamaños y estados**

Acciones primarias y filas táctiles usarán `min-h-11`. Icon buttons compactos tendrán `size-10` o área equivalente con separación de 4 px. Contenedores de carga recibirán `aria-busy`; no se crearán live regions anidadas.

- [ ] **Step 5: Crear E2E de teclado**

El test usará `page.keyboard.press('Tab')`, `Enter`, `Escape` y verificará foco después de cada diálogo. No usará `.click()` en el recorrido principal. `zoom-reflow` aplicará `document.body.style.zoom = '2'` y comprobará `scrollWidth <= clientWidth + 1` en login, billing, cash, reports y users.

- [ ] **Step 6: Ejecutar accesibilidad enfocada**

Run:

```powershell
Set-Location frontend
npx playwright test e2e/keyboard-critical-flow.spec.ts e2e/zoom-reflow.spec.ts e2e/accessibility.spec.ts --workers=1
```

Expected: PASS; axe crítica/seria 0, sin overflow a 200% y foco restaurado.

- [ ] **Step 7: Documentar checklist manual**

El checklist incluirá NVDA/Chrome: landmarks, skip link, lectura de total, error de pago, diálogo de anulación, menú de acciones, tabla de reportes y salida de sesión. Cada punto tendrá `PASS`, `FAIL` o `NO EJECUTADO`; `NO EJECUTADO` impide aprobación física.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/components/ui frontend/src/features/invoices/components/PaymentModal.tsx frontend/src/features/cash/components/CloseSessionDialog.tsx frontend/src/features/admin/components/UserFormDialog.tsx frontend/e2e docs/accessibility-manual-checklist.md
git commit -m "feat(a11y): complete keyboard and reflow safeguards"
```

### Task 9: Catálogo escalable y presupuestos de consultas backend

**Files:**
- Modify: `backend/app/Http/Controllers/ServiceController.php`
- Modify: `backend/app/Support/ServiceSearch.php`
- Create: `backend/tests/Feature/Performance/ServiceSearchPerformanceTest.php`
- Create: `backend/tests/Feature/Performance/OperationalQueryBudgetTest.php`
- Modify: `backend/tests/Feature/ServiceCatalogTest.php`

**Interfaces:**
- Produce: `ServiceSearch::candidateNeedles(string $search): array` con término normalizado y tokens de al menos 2 caracteres.
- Mantiene intacta la respuesta paginada `/api/services`.

- [ ] **Step 1: Escribir prueba roja con 10,000 servicios**

```php
public function test_billing_search_limits_fuzzy_candidates_before_php_filtering(): void
{
    Service::factory()->count(10_000)->create(['active' => true, 'visible_in_billing' => true, 'is_billable' => true]);
    Service::factory()->create(['name' => 'Eritropoyetina', 'active' => true, 'visible_in_billing' => true, 'is_billable' => true]);

    $this->capturedSql = [];
    DB::listen(function (QueryExecuted $query): void {
        $this->capturedSql[] = strtolower($query->sql);
    });

    $response = $this->actingAs($this->cashier())->getJson('/api/services?billing=1&search=eritro&per_page=24');

    $response->assertOk()->assertJsonPath('data.0.name', 'Eritropoyetina');
    $this->assertTrue(collect($this->capturedSql)->contains(
        fn (string $sql): bool => str_contains($sql, 'from `services`') && str_contains($sql, 'limit 120')
    ));
}
```

- [ ] **Step 2: Ejecutar prueba roja**

Run: `docker compose exec -T backend php artisan test --compact tests/Feature/Performance/ServiceSearchPerformanceTest.php`

Expected: FAIL porque el controlador carga todos los servicios elegibles.

- [ ] **Step 3: Reducir candidatos en SQL**

```php
$needles = ServiceSearch::candidateNeedles($request->string('search')->toString());
$candidateQuery = (clone $query)->where(function (Builder $candidate) use ($needles): void {
    foreach ($needles as $needle) {
        $candidate->orWhere('services.name', 'like', "%{$needle}%")
            ->orWhere('services.slug', 'like', "%{$needle}%")
            ->orWhereHas('category', fn (Builder $category) => $category->where('name', 'like', "%{$needle}%"))
            ->orWhereHas('area', fn (Builder $area) => $area->where('name', 'like', "%{$needle}%"));
    }
});
$services = $this->fuzzySearch($candidateQuery->limit(120)->get(), $search, $request);
```

Escapar `%`, `_` y `\` mediante el helper existente antes del LIKE. Si no hay token de dos caracteres, el endpoint devuelve lista vacía salvo búsqueda exacta por código.

- [ ] **Step 4: Agregar presupuestos de queries**

`OperationalQueryBudgetTest` contará `DB::listen` y exigirá: servicios <= 5 queries, historial <= 8, dashboard today <= 12, reporte ejecutivo <= 14. Las factories se crearán antes de iniciar el contador.

- [ ] **Step 5: Confirmar índices con MariaDB**

Run:

```powershell
docker compose exec -T mysql sh -lc 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -e "EXPLAIN SELECT id,name FROM services WHERE active=1 AND name LIKE ''eritro%'' ORDER BY name LIMIT 120;"'
```

Expected: usa un índice cuyo prefijo comienza por `active`; si el índice actual `services(active,name)` aparece, no crear migración.

- [ ] **Step 6: Ejecutar gates backend enfocados**

Run:

```powershell
docker compose exec -T backend php artisan test --compact tests/Feature/Performance tests/Feature/ServiceCatalogTest.php
docker compose exec -T backend vendor/bin/pint --test app/Http/Controllers/ServiceController.php app/Support/ServiceSearch.php tests/Feature/Performance
docker compose exec -T backend vendor/bin/phpstan analyse --memory-limit=1G app/Http/Controllers/ServiceController.php app/Support/ServiceSearch.php
```

Expected: PASS y contrato JSON sin cambios.

- [ ] **Step 7: Commit**

```powershell
git add backend/app/Http/Controllers/ServiceController.php backend/app/Support/ServiceSearch.php backend/tests/Feature/Performance backend/tests/Feature/ServiceCatalogTest.php
git commit -m "perf(catalog): bound fuzzy service search candidates"
```

### Task 10: Gate único de liberación y aceptación

**Files:**
- Modify: `docs/testing-report.md`
- Modify: `CHANGELOG.md`
- Modify: `qa/FINAL_RC_CUTOVER_2026_06_12.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: todas las tareas anteriores.
- Produces: evidencia final reproducible, un solo resultado de release y árbol Git limpio.

- [ ] **Step 1: Ejecutar frontend completo una sola vez**

```powershell
Set-Location C:\Projects\S_Hospital\frontend
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run performance:budget
```

Expected: 0 fallos; cobertura no baja de 65% líneas, 60% funciones, 60% ramas y 65% sentencias; presupuestos de Task 2 aprobados.

- [ ] **Step 2: Ejecutar backend completo una sola vez**

```powershell
Set-Location C:\Projects\S_Hospital
docker compose exec -T backend php artisan test
docker compose exec -T backend vendor/bin/pint --test
docker compose exec -T backend vendor/bin/phpstan analyse --memory-limit=1G
```

Expected: 0 fallos de código; skips de entorno se enumeran por nombre.

- [ ] **Step 3: Ejecutar E2E crítico y real**

```powershell
Set-Location C:\Projects\S_Hospital\frontend
npx playwright test e2e/new-invoice-flow.spec.ts e2e/cashbox.spec.ts e2e/invoice-history-flow.spec.ts e2e/reports-flow.spec.ts e2e/users-flow.spec.ts e2e/keyboard-critical-flow.spec.ts e2e/zoom-reflow.spec.ts --workers=1
Set-Location C:\Projects\S_Hospital
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run_release_e2e_mariadb.ps1 -SeedPassword $env:E2E_RELEASE_PASSWORD
```

Expected: emisión, cobro, PDF institucional, reimpresión, cierre, reportes y RBAC PASS sobre MariaDB.

- [ ] **Step 4: Ejecutar matrices visuales al final**

```powershell
Set-Location C:\Projects\S_Hospital\frontend
npx playwright test e2e/v1-2-full-a11y.spec.ts e2e/v1-2-visible-ui-a11y.spec.ts --workers=1
```

Expected: seis viewports PASS, axe critical/serious 0 y screenshots actuales sin controles técnicos de impresión.

- [ ] **Step 5: Ejecutar instalación y seguridad**

```powershell
Set-Location C:\Projects\S_Hospital
powershell -File scripts/deploy_hospital_lan.ps1 -SelfTest
powershell -File scripts/offline_release_contract.test.ps1
powershell -File scripts/production_readiness_preflight.test.ps1
powershell -File scripts/test_pre_commit_guard.ps1
powershell -File scripts/audit_offline_dependencies.ps1
Set-Location frontend
npm audit --omit=dev --audit-level=high
```

Expected: instalador 36/36, contratos PASS, 0 hallazgos críticos y 0 vulnerabilidades high.

- [ ] **Step 6: Actualizar evidencia sin esconder resultados**

`docs/testing-report.md` registrará comando, duración, conteo y resultado. `CHANGELOG.md` resumirá velocidad, UX y accesibilidad. El checklist RC separará prueba automatizada de impresora/LAN física.

- [ ] **Step 7: Revisar placeholders, secretos y árbol**

Run:

```powershell
git diff --check
powershell -File scripts/pre-commit-guard.ps1
git status --short
```

Expected: sin marcadores incompletos, sin secretos, sin whitespace errors y solo los archivos de documentación final antes del commit.

- [ ] **Step 8: Commit final**

```powershell
git add README.md CHANGELOG.md docs/testing-report.md qa/FINAL_RC_CUTOVER_2026_06_12.md
git commit -m "docs(release): close performance ux accessibility gate"
git status --short
```

Expected: árbol limpio. No declarar `PRODUCTION_READY` hasta completar LAN, impresora Carta/Media carta/A5 y restauración controlada en el hardware del hospital.

## Cadencia de ejecución

| Jornada | Tasks | Gate máximo durante la jornada | Entregable |
|---|---|---|---|
| 1 | 1-2 | tests de scripts + build/presupuesto | verificación rápida y métricas |
| 2 | 3-4 | Shell/Billing + E2E de factura | carga y búsqueda rápidas |
| 3 | 5 | Billing enfocado | POS más simple |
| 4 | 6-7 | Shell/Reports/Admin | menos duplicación y densidad |
| 5 | 8-9 | a11y enfocado + backend performance | teclado, reflow y escala |
| 6 | 10 | release completo una sola vez | candidato documentado |

## Trabajo excluido de este plan

- migrar React, Laravel, Tailwind, MariaDB o librerías UI;
- introducir animaciones cinematográficas, glassmorphism, texturas o imágenes;
- cambiar reglas fiscales, contables o de impresión ya aprobadas;
- crear una app móvil o PWA distinta;
- agregar módulos clínicos;
- ejecutar matrices completas después de cada cambio pequeño.
