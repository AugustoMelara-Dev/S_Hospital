# Operational Core: Shell, Login, Billing, and Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make login, shell, patient-to-payment billing, and partial Dashboard failures fast, compact, keyboard accessible, and usable from 320 to 1920 px with one document scroll.

**Architecture:** Existing API hooks and invoice reducer remain authoritative. Ant Design components are recomposed into responsive page regions; a shared responsive account access pattern switches between a bounded desktop aside and an accessible Drawer plus bottom action bar. Geometry is verified by the audit fixture from Plan 1.

**Tech Stack:** React 19, TypeScript, Ant Design 6, Ant Design Icons, React Hook Form, Zod, TanStack Query, Day.js, Vitest, Testing Library, Playwright, axe.

## Global Constraints

- Preserve the stack and offline LAN operation defined in the design spec.
- Add no visual framework, CDN, cloud dependency, fiscal calculation, or timeout increase.
- Preserve backend totals, permissions, Sanctum, idempotency, and invoice/payment contracts.
- Keep global `borderRadius: 0`.
- Do not create Compat, Legacy, V1, or temporary adapter wrappers.
- Desktop account width is 360–420 px; tablet is 768–1279 px; mobile is below 768 px.

---

## File Map

- `frontend/src/shell/InstitutionalShell.tsx`: responsive shell frame and one document scroll.
- `frontend/src/shell/navigation/InstitutionalRail.tsx`: narrower institutional navigation without unnecessary internal scroll.
- `frontend/src/shell/status/ContextBar.tsx`: current location, cash, search, help, and user only.
- `frontend/src/features/auth/LoginView.tsx`: stable neutral submission state.
- `frontend/src/features/dashboard/DashboardView.tsx`: independently failing setup-status region.
- `frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx`: responsive billing composition.
- `frontend/src/features/invoices/components/BillingAccountDrawer.tsx`: tablet/mobile account surface.
- `frontend/src/features/invoices/components/BillingBottomBar.tsx`: persistent account access.
- `frontend/src/features/invoices/components/PatientStep.tsx`: compact patient fields.
- `frontend/src/features/invoices/components/ServiceSearch.tsx`: clickable/keyboard service rows and controlled results.
- `frontend/src/features/invoices/components/InvoiceCart.tsx`: compact account table and totals.
- `frontend/src/features/invoices/components/PaymentModal.tsx`: payment hierarchy and method-specific fields.
- Corresponding `*.test.tsx` and `frontend/e2e/new-invoice-flow.spec.ts`: behavior and geometry.

### Task 1: Simplify the institutional shell

**Files:**
- Modify: `frontend/src/shell/InstitutionalShell.tsx`
- Modify: `frontend/src/shell/navigation/InstitutionalRail.tsx`
- Modify: `frontend/src/shell/status/ContextBar.tsx`
- Modify: `frontend/src/shell/InstitutionalShell.test.tsx`
- Modify: `frontend/src/shell/InstitutionalShell.a11y.test.tsx`

**Interfaces:**
- Preserve `InstitutionalShellProps` and navigation permission filtering.
- Produce `data-audit-panel="navigation"`, `data-audit-panel="context-bar"`, and `data-audit-panel="content"`.

- [ ] **Step 1: Add failing shell assertions**

```tsx
it('renders one location title and no unnecessary rail scroll', () => {
  renderShell('/billing/new');
  expect(screen.getAllByText('Nueva factura')).toHaveLength(1);
  const railNavigation = screen.getByRole('navigation', { name: /navegación principal/i });
  expect(railNavigation).toHaveAttribute('data-scroll-when-needed', 'true');
  expect(screen.getByTestId('institutional-rail')).toHaveAttribute('data-expanded-width', '224');
});
```

- [ ] **Step 2: Run and verify current duplication/width failure**

Run: `cd frontend; npm.cmd exec vitest run src/shell/InstitutionalShell.test.tsx src/shell/InstitutionalShell.a11y.test.tsx`

Expected: FAIL because the rail is 256 px and page/header titles are repeated.

- [ ] **Step 3: Implement the shell contract**

Change the expanded rail classes to `lg:w-56` and the content offset to `lg:pl-56`. Keep collapsed width `lg:w-20`. Give the navigation this exact behavior:

```tsx
<nav
  aria-label="Navegación principal"
  data-scroll-when-needed="true"
  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 [scrollbar-gutter:stable]"
>
```

Remove the duplicated user card from the rail footer because user already lives in `ContextBar`. Replace the brand copy with the canonical hospital name/wordmark source. `ContextBar` renders a single H1-like current task label, cash status, command search, help, and user; remove breadcrumb output when it duplicates the current label.

- [ ] **Step 4: Run shell tests and axe**

Run: `cd frontend; npm.cmd exec vitest run src/shell/InstitutionalShell.test.tsx src/shell/InstitutionalShell.a11y.test.tsx src/shell/InstitutionalShell.naming.test.ts`

Expected: PASS with one visible task title and no axe violations.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/shell
git commit -m "fix(shell): simplify institutional navigation hierarchy"
```

### Task 2: Neutral login and resilient Dashboard

**Files:**
- Modify: `frontend/src/features/auth/LoginView.tsx`
- Modify: `frontend/src/features/auth/LoginView.test.tsx`
- Modify: `frontend/src/features/dashboard/DashboardView.tsx`
- Modify: `frontend/src/features/dashboard/DashboardView.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Login consumes existing `submitting` and `status`; no API contract change.
- Dashboard setup status is an independent region with `role="status"` or contextual `Alert`.

- [ ] **Step 1: Write failing login loading test**

```tsx
it('uses neutral feedback while credentials are being validated', () => {
  render(<LoginView {...props} submitting status="Validando credenciales" />);
  expect(screen.getByRole('button', { name: /validando credenciales/i })).toBeDisabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Validando credenciales');
});
```

- [ ] **Step 2: Write failing Dashboard partial-error test**

```tsx
it('keeps operational data when setup status fails', async () => {
  mockDashboardReportSuccess();
  mockSetupStatusFailure();
  renderDashboard();
  expect(await screen.findByText(/ingresos de hoy/i)).toBeVisible();
  expect(screen.getByText(/no se pudo verificar la configuración inicial/i)).toBeVisible();
  expect(screen.getByRole('button', { name: /reintentar verificación/i })).toBeVisible();
});
```

- [ ] **Step 3: Run and verify failures**

Run: `cd frontend; npm.cmd exec vitest run src/features/auth/LoginView.test.tsx src/features/dashboard/DashboardView.test.tsx`

Expected: FAIL because loading uses error severity or setup failure replaces the whole Dashboard.

- [ ] **Step 4: Implement stable login state**

Render a fixed-height status slot:

```tsx
<div className="min-h-6" aria-live="polite">
  {submitting ? <span role="status">Validando credenciales</span> : null}
  {!submitting && error ? <Alert type="error" showIcon message={error} /> : null}
</div>
<Button htmlType="submit" type="primary" loading={submitting} disabled={submitting} block>
  {submitting ? 'Validando credenciales' : 'Iniciar sesión'}
</Button>
```

Ensure the submit handler returns immediately when `submitting` is true.

- [ ] **Step 5: Isolate Dashboard setup state**

Keep report rendering outside setup-status conditionals. In the setup region only:

```tsx
{setupStatusQuery.isError ? (
  <Alert
    type="warning"
    showIcon
    message="No se pudo verificar la configuración inicial"
    action={<Button size="small" onClick={() => setupStatusQuery.refetch()}>Reintentar verificación</Button>}
  />
) : null}
```

- [ ] **Step 6: Run tests and commit**

Run: `cd frontend; npm.cmd exec vitest run src/features/auth/LoginView.test.tsx src/features/auth/LoginView.a11y.test.tsx src/features/dashboard/DashboardView.test.tsx`

Expected: PASS.

```powershell
git add frontend/src/features/auth frontend/src/features/dashboard frontend/src/App.tsx
git commit -m "fix(auth): stabilize login and dashboard network states"
```

### Task 3: Responsive billing composition

**Files:**
- Create: `frontend/src/features/invoices/components/BillingAccountDrawer.tsx`
- Create: `frontend/src/features/invoices/components/BillingBottomBar.tsx`
- Modify: `frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx`
- Modify: `frontend/src/features/invoices/components/NewInvoiceViewLayout.test.tsx`
- Modify: `frontend/src/features/invoices/components/NewInvoiceViewLayout.a11y.test.tsx`
- Modify: `frontend/src/features/invoices/NewInvoiceView.tsx`

**Interfaces:**
- `BillingAccountDrawerProps = { open: boolean; onClose(): void; children: ReactNode }`.
- `BillingBottomBarProps = { itemCount: number; total: string; onOpen(): void }`.
- Preserve all `NewInvoiceLayoutProps` business callbacks.

- [ ] **Step 1: Add failing composition tests**

```tsx
it('uses a bounded account aside on desktop', () => {
  setMatchMedia('(min-width: 1280px)', true);
  renderLayout();
  expect(screen.getByTestId('billing-account-desktop')).toHaveStyle({ width: 'min(420px, 31vw)' });
  expect(screen.queryByRole('button', { name: /ver cuenta/i })).not.toBeInTheDocument();
});

it('uses a bottom bar and drawer below desktop', async () => {
  setMatchMedia('(min-width: 1280px)', false);
  renderLayout({ cartItems: [cartItem] });
  await user.click(screen.getByRole('button', { name: /ver cuenta/i }));
  expect(screen.getByRole('dialog', { name: /cuenta actual/i })).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend; npm.cmd exec vitest run src/features/invoices/components/NewInvoiceViewLayout.test.tsx`

Expected: FAIL because the current layout always reserves a desktop grid column.

- [ ] **Step 3: Implement the responsive account components**

```tsx
export function BillingBottomBar({ itemCount, total, onOpen }: BillingBottomBarProps) {
  return (
    <div data-audit-panel="billing-bottom-bar" className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface p-3 xl:hidden">
      <Button type="primary" block onClick={onOpen} aria-label={`Ver cuenta, ${itemCount} servicios, total ${total}`}>
        <span>{itemCount} servicios</span><strong className="ml-auto tabular-nums">{total}</strong><span>Ver cuenta</span>
      </Button>
    </div>
  );
}

export function BillingAccountDrawer({ open, onClose, children }: BillingAccountDrawerProps) {
  return (
    <Drawer title="Cuenta actual" open={open} onClose={onClose} width="min(100vw, 480px)" placement="right" className="billing-account-drawer">
      {children}
    </Drawer>
  );
}
```

In `NewInvoiceViewLayout`, use:

```tsx
<div data-billing-workspace className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
  <main data-audit-panel="billing-main" className="min-w-0 space-y-4">...</main>
  <aside data-testid="billing-account-desktop" data-audit-panel="billing-account" className="hidden min-w-0 self-start xl:sticky xl:top-20 xl:block" style={{ width: 'min(420px, 31vw)' }}>...</aside>
</div>
```

Use `pb-24 xl:pb-0` only while the bottom bar is rendered.

- [ ] **Step 4: Run component and axe tests**

Run: `cd frontend; npm.cmd exec vitest run src/features/invoices/components/NewInvoiceViewLayout.test.tsx src/features/invoices/components/NewInvoiceViewLayout.a11y.test.tsx`

Expected: PASS with focus returned to “Ver cuenta” after Drawer closes.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/features/invoices/components/BillingAccountDrawer.tsx frontend/src/features/invoices/components/BillingBottomBar.tsx frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx frontend/src/features/invoices/components/NewInvoiceViewLayout.test.tsx frontend/src/features/invoices/components/NewInvoiceViewLayout.a11y.test.tsx frontend/src/features/invoices/NewInvoiceView.tsx
git commit -m "feat(billing): add responsive account composition"
```

### Task 4: Compact patient and keyboard-first services

**Files:**
- Modify: `frontend/src/features/invoices/components/PatientStep.tsx`
- Modify: `frontend/src/features/invoices/components/PatientStep.test.tsx`
- Modify: `frontend/src/features/invoices/components/ServiceSearch.tsx`
- Modify: `frontend/src/features/invoices/components/ServiceSearch.test.tsx`
- Modify: `frontend/src/features/invoices/hooks/useNewInvoiceShortcuts.ts`

**Interfaces:**
- Preserve `onAddService(service)` and existing service type.
- Service row has `role="button"`, `tabIndex=0`, and an accessible name `Agregar <service name>`.

- [ ] **Step 1: Add failing patient density test**

```tsx
it('shows one compact required field before optional data', () => {
  render(<PatientStep {...props} />);
  expect(screen.getByLabelText(/nombre del paciente/i)).toBeVisible();
  expect(screen.getByRole('button', { name: /datos opcionales/i })).toBeVisible();
  expect(screen.queryByText(/identificar paciente/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Add failing row click and Enter tests**

```tsx
it.each(['click', 'Enter'] as const)('adds a service with %s', async (interaction) => {
  const onAddService = vi.fn();
  render(<ServiceSearch {...props} services={[glucose]} onAddService={onAddService} />);
  const row = screen.getByRole('button', { name: /agregar glucosa/i });
  interaction === 'click' ? await user.click(row) : (row.focus(), await user.keyboard('{Enter}'));
  expect(onAddService).toHaveBeenCalledWith(glucose);
});

it('Enter in search adds the first eligible result', async () => {
  render(<ServiceSearch {...props} services={[glucose]} onAddService={onAddService} />);
  await user.type(screen.getByLabelText(/buscar servicio/i), 'glu{Enter}');
  expect(onAddService).toHaveBeenCalledWith(glucose);
});
```

- [ ] **Step 3: Implement compact sections and row activation**

Use a single Ant Design `Input` for patient name and `Collapse ghost` or text button for optional fields. In `ServiceSearch`:

```tsx
const activate = (service: Service) => onAddService(service);
<div
  role="button"
  tabIndex={0}
  aria-label={`Agregar ${service.name}`}
  onClick={() => activate(service)}
  onKeyDown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(service);
    }
  }}
  className="grid min-h-14 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center border-b px-3 py-2 focus-visible:outline focus-visible:outline-2"
>
```

Build classification with a normalized unique array so identical category/area appears once.

- [ ] **Step 4: Remove nested service scrolling**

Delete fixed heights and `overflow-y-auto` from service results. Keep server pagination or incremental “Cargar más” in normal document flow.

- [ ] **Step 5: Run tests and commit**

Run: `cd frontend; npm.cmd exec vitest run src/features/invoices/components/PatientStep.test.tsx src/features/invoices/components/ServiceSearch.test.tsx`

Expected: PASS.

```powershell
git add frontend/src/features/invoices/components/PatientStep.tsx frontend/src/features/invoices/components/PatientStep.test.tsx frontend/src/features/invoices/components/ServiceSearch.tsx frontend/src/features/invoices/components/ServiceSearch.test.tsx frontend/src/features/invoices/hooks/useNewInvoiceShortcuts.ts
git commit -m "fix(billing): compact patient and service selection"
```

### Task 5: Compact account and method-specific payment

**Files:**
- Modify: `frontend/src/features/invoices/components/InvoiceCart.tsx`
- Modify: `frontend/src/features/invoices/components/InvoiceCart.test.tsx`
- Modify: `frontend/src/features/invoices/components/PaymentModal.tsx`
- Modify: `frontend/src/features/invoices/components/PaymentModal.test.tsx`

**Interfaces:**
- Preserve cart callbacks and backend preview strings.
- Payment cash presets set `amountReceived`; non-cash methods set it to invoice total only in submission payload and do not render the field.

- [ ] **Step 1: Add failing account hierarchy test**

```tsx
it('renders one compact account table and no promotional total block', () => {
  renderCartWithTwoItems();
  expect(screen.getByRole('table', { name: /cuenta actual/i })).toBeVisible();
  expect(screen.getByText('Subtotal')).toBeVisible();
  expect(screen.getByText('ISV')).toBeVisible();
  expect(screen.getByText('Total')).toBeVisible();
  expect(screen.queryByText(/total estimado/i)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /emitir y cobrar/i })).toBeVisible();
});
```

- [ ] **Step 2: Add payment mode tests**

```tsx
it('shows presets and prominent change for cash', async () => {
  renderPayment({ method: 'cash', total: '69.00' });
  await user.click(screen.getByRole('button', { name: 'L100' }));
  expect(screen.getByLabelText(/monto recibido/i)).toHaveValue('100.00');
  expect(screen.getByTestId('payment-change')).toHaveTextContent('L 31.00');
});

it.each(['card', 'transfer'] as const)('hides received and change for %s', (method) => {
  renderPayment({ method, total: '69.00' });
  expect(screen.queryByLabelText(/monto recibido/i)).not.toBeInTheDocument();
  expect(screen.queryByTestId('payment-change')).not.toBeInTheDocument();
  expect(screen.getByLabelText(/referencia/i)).toBeVisible();
});
```

- [ ] **Step 3: Implement cart table**

Use semantic `<table>` markup for service, quantity, and amount. Quantity buttons keep 44 px hit areas. Totals are `<dl>` rows with tabular figures; total uses font weight/size only. Place field errors directly below their associated control.

- [ ] **Step 4: Implement payment hierarchy and double-submit lock**

Render presets `Exacto`, `L100`, `L200`, `L500` only for cash. Compute display change with existing cents helpers. Use the existing mutation pending state plus a synchronous ref lock:

```tsx
const submitLock = useRef(false);
const submit = () => {
  if (submitLock.current || submitting) return;
  submitLock.current = true;
  onSubmitPayment(appliedAmount);
};
useEffect(() => { if (!submitting) submitLock.current = false; }, [submitting]);
```

- [ ] **Step 5: Run tests and commit**

Run: `cd frontend; npm.cmd exec vitest run src/features/invoices/components/InvoiceCart.test.tsx src/features/invoices/components/PaymentModal.test.tsx`

Expected: PASS including immediate validation and duplicate-click test.

```powershell
git add frontend/src/features/invoices/components/InvoiceCart.tsx frontend/src/features/invoices/components/InvoiceCart.test.tsx frontend/src/features/invoices/components/PaymentModal.tsx frontend/src/features/invoices/components/PaymentModal.test.tsx
git commit -m "fix(payments): prioritize received amount and change"
```

### Task 6: Operational core browser gate

**Files:**
- Modify: `frontend/e2e/new-invoice-flow.spec.ts`
- Modify: `frontend/e2e/operational-ux-baseline.spec.ts`
- Create: `qa/operational-ux/core-review.md`

- [ ] **Step 1: Add geometry and keyboard assertions**

For each required viewport, fill patient, search and add with Enter, open account where applicable, and assert:

```ts
const auditObserver = observeOperationalPage(page);
await page.goto('/billing/new');
await page.getByLabel(/nombre del paciente/i).fill('Paciente QA');
await page.getByLabel(/buscar servicio/i).fill('glucosa');
await page.getByLabel(/buscar servicio/i).press('Enter');
const audit = await auditObserver.capture({ routeName, primaryAction: 'Emitir y cobrar', testInfo });
assertNoDocumentOverflow(audit);
expect(audit.scrollContainers.filter((item) => item.selector !== 'body')).toHaveLength(0);
expect(audit.primaryAction).toEqual({ visible: true, covered: false });
```

At tablet/mobile, assert the bottom bar is visible and does not overlap the focused quantity control. At desktop, assert account width is between 360 and 420 CSS px.

- [ ] **Step 2: Execute the focused gate**

```powershell
cd frontend
npm.cmd exec vitest run LoginView DashboardView InstitutionalShell NewInvoiceView PatientStep ServiceSearch InvoiceCart PaymentModal
npm.cmd run test:storybook
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd exec playwright test e2e/new-invoice-flow.spec.ts e2e/operational-ux-baseline.spec.ts
```

Expected: PASS for login, Dashboard, shell, billing, payment, all required viewports, and axe checks.

- [ ] **Step 3: Review screenshots manually**

Open every generated core screenshot. Record pass/fail for horizontal overflow, nested scroll, covered controls, first results, sticky behavior, truncation, English, duplicate pagination, and visual hierarchy in `qa/operational-ux/core-review.md`.

- [ ] **Step 4: Commit**

```powershell
git add frontend/e2e/new-invoice-flow.spec.ts frontend/e2e/operational-ux-baseline.spec.ts qa/operational-ux/core-review.md qa/operational-ux/after
git commit -m "test(billing): verify responsive operational core"
```
