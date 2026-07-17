# S_Hospital Total shadcn UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Ant Design, AG Grid and ECharts with a complete offline-capable shadcn/ui interface using TanStack Table and Recharts, including saved and printed institutional receipts.

**Architecture:** Migrate vertically by operational module. Establish the official Nova style on the Radix base (`style: radix-nova`) and stable institutional patterns first, then move shell/auth, billing/receipts, cash/history, catalog/reports and administration before deleting every legacy dependency. Preserve API contracts and business behavior; each task ends with focused tests and a Conventional Commit.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Tailwind CSS 4, shadcn/ui `radix-nova`, Radix UI, TanStack Table, Recharts, React Hook Form, Zod, Sonner, Vitest, Testing Library, axe-core and Playwright.

## Global Constraints

- Production must work without internet on the hospital LAN.
- Use only official shadcn registry components; do not add community blocks.
- Keep `frontend/src/styles.css` as the global CSS entry point.
- Preserve backend API contracts, money calculations, fiscal rules, permissions and numbering.
- Preserve saved invoice and receipt snapshots; never recalculate history from the live catalog.
- The main receipt must support Letter, Half Letter and A5 and must not expose QR, barcodes or internal codes.
- Keep 80 mm and 58 mm only as secondary compatibility formats.
- Target WCAG 2.2 AA, visible focus, keyboard operation and reduced motion.
- Avoid floats for money and keep financial values tabular.
- Do not overwrite the pre-existing `frontend/package-lock.json` or tracked QA image changes blindly; inspect and merge their diff.
- Do not remove a legacy package until repository search proves it has zero consumers.
- Each task must leave its migrated modules free of Ant Design, AG Grid and ECharts imports.
- Use Conventional Commits and do not mix unrelated modules in one commit.

---

## File and interface map

### New foundation files

- `frontend/components.json`: shadcn CLI configuration for Vite, Tailwind 4, Nova on Radix, CSS variables and `@/` aliases.
- `frontend/src/components/ui/*.tsx`: official shadcn source files used by the application.
- `frontend/src/design-system/patterns/DataTable.tsx`: typed TanStack Table composition.
- `frontend/src/design-system/patterns/InstitutionalChart.tsx`: Recharts/shadcn Chart composition and accessible alternative.
- `frontend/src/design-system/providers/FeedbackProvider.tsx`: stable application feedback interface backed by Sonner.
- `frontend/src/design-system/providers/ThemeProvider.tsx`: local theme class and semantic color application.
- `frontend/src/design-system/tokens/institutional-tokens.css`: shadcn-compatible institutional tokens.

### Stable interfaces consumed by migrated modules

```ts
export type FeedbackLevel = 'success' | 'info' | 'warning' | 'error';
export type FeedbackMessage = { key: string; level: FeedbackLevel; message: string };
export type FeedbackApi = { notify(input: FeedbackMessage): void };

export type DataTableState = 'ready' | 'loading' | 'empty' | 'error';
export type DataTablePriority = 'primary' | 'secondary' | 'optional';
export type InstitutionalColumn<TData> = ColumnDef<TData> & {
  id: string;
  priority?: DataTablePriority;
};

export type InstitutionalChartProps = {
  ariaLabel: string;
  children: React.ReactNode;
  config: ChartConfig;
  state?: 'ready' | 'loading' | 'empty' | 'error';
  summary?: string;
  alternativeTable: React.ReactNode;
};
```

### Files removed at convergence

- `frontend/src/design-system/antd/`
- `frontend/src/design-system/ag-grid/`
- `frontend/src/design-system/echarts/`
- `frontend/src/design-system/themes/institutionalTheme.ts`
- Ant-specific provider and CSS selectors after their consumers reach zero.

---

### Task 1: Establish the official shadcn foundation and dependency boundary

**Files:**
- Create: `frontend/components.json`
- Create: `frontend/src/components/ui/*.tsx`
- Modify: `frontend/package.json`
- Merge: `frontend/package-lock.json`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/design-system/tokens/institutional-tokens.css`
- Create: `frontend/src/test/shadcn-foundation.test.ts`
- Modify: `frontend/scripts/ui-legacy-audit.mjs`
- Test: `frontend/scripts/ui-legacy-audit.test.ts`

**Interfaces:**
- Produces the `@/components/ui/*` imports, `cn()` utility, semantic CSS tokens and dependency guard used by every later task.
- Keeps legacy dependencies temporarily because non-migrated modules still consume them.

- [ ] **Step 1: Record the dirty lockfile and baseline bundle without changing them**

Run:

```powershell
git diff -- frontend/package-lock.json
Set-Location frontend
npm run build
npm run budget:bundle
```

Expected: build passes; save the reported initial and total gzip values in the task commit message body.

- [ ] **Step 2: Add a failing architecture test for the foundation contract**

Create `src/test/shadcn-foundation.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

describe('shadcn foundation', () => {
  it('uses radix-nova, the existing alias and the global stylesheet', () => {
    const config = JSON.parse(readFileSync(resolve(root, 'components.json'), 'utf8'));
    expect(config.style).toBe('nova');
    expect(config.tailwind.css).toBe('src/styles.css');
    expect(config.aliases.ui).toBe('@/components/ui');
    expect(config.iconLibrary).toBe('lucide');
  });

  it('exposes semantic rounded tokens without remote assets', () => {
    const css = readFileSync(resolve(root, 'src/styles.css'), 'utf8');
    expect(css).toContain('@theme inline');
    expect(css).toContain('--radius:');
    expect(css).not.toMatch(/https?:\/\//);
  });
});
```

- [ ] **Step 3: Run the test and verify the missing configuration failure**

Run: `npm run test -- shadcn-foundation.test.ts`

Expected: FAIL because `components.json` does not exist.

- [ ] **Step 4: Inspect the official CLI context and component documentation**

Run:

```powershell
npx shadcn@latest info --json
npx shadcn@latest docs button field input select checkbox switch dialog alert-dialog sheet drawer dropdown-menu tabs accordion card alert empty skeleton spinner sidebar breadcrumb command pagination table chart sonner calendar popover
```

Expected: the CLI reports Vite, React 19, Tailwind 4 and package manager `npm`; documentation URLs are returned for every requested component.

- [ ] **Step 5: Initialize and add the official components**

Run inside `frontend`:

```powershell
npx shadcn@latest init --base radix --preset nova
npx shadcn@latest add button field input textarea select checkbox switch radio-group toggle-group dialog alert-dialog sheet drawer dropdown-menu tabs accordion collapsible card badge alert empty skeleton spinner sidebar breadcrumb command pagination table chart sonner calendar popover tooltip separator scroll-area progress avatar
```

Expected: `components.json` and local component source files are created; no community registry package is referenced.

- [ ] **Step 6: Merge institutional tokens into the generated stylesheet**

Keep shadcn variables in `src/styles.css` and map the existing product semantics:

```css
@theme inline {
  --color-surface: var(--card);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-error: var(--destructive);
  --font-sans: "IBM Plex Sans Variable", ui-sans-serif, system-ui, sans-serif;
}

:root {
  --radius: 0.625rem;
  --success: oklch(0.52 0.12 160);
  --warning: oklch(0.67 0.14 75);
}

.dark {
  --success: oklch(0.72 0.12 160);
  --warning: oklch(0.78 0.12 75);
}
```

Preserve receipt-paper tokens and every semantic token still consumed by non-migrated modules.

- [ ] **Step 7: Extend the legacy audit with new-import prevention**

Add exact dependency kinds for `antd`, `@ant-design/icons`, `ag-grid-community`, `ag-grid-react` and `echarts`. Keep inventory mode non-blocking, make strict mode reject new consumers in migrated prefixes and make final mode reject every consumer.

- [ ] **Step 8: Run foundation checks**

Run:

```powershell
npm run test -- shadcn-foundation.test.ts ui-legacy-audit.test.ts
npm run typecheck
npm run lint
npm run build
```

Expected: all commands pass. Review every generated component for correct alias, Radix `asChild`, accessible titles and configured Lucide imports.

- [ ] **Step 9: Commit the foundation**

```powershell
git add frontend/components.json frontend/package.json frontend/package-lock.json frontend/src/components frontend/src/styles.css frontend/src/design-system/tokens frontend/src/test/shadcn-foundation.test.ts frontend/scripts/ui-legacy-audit.mjs frontend/scripts/ui-legacy-audit.test.ts
git commit -m "feat(ui): establish shadcn foundation"
```

### Task 2: Replace providers and shared institutional patterns

**Files:**
- Create: `frontend/src/design-system/providers/ThemeProvider.tsx`
- Modify: `frontend/src/design-system/providers/FeedbackProvider.tsx`
- Modify: `frontend/src/design-system/components/PageHeader.tsx`
- Modify: `frontend/src/design-system/components/InstitutionalComponents.tsx`
- Modify: `frontend/src/design-system/patterns/RouteState.tsx`
- Modify: `frontend/src/design-system/index.ts`
- Modify: `frontend/src/hooks/useTheme.ts`
- Modify: `frontend/src/App.tsx`
- Delete after consumers move: `frontend/src/design-system/providers/DesignSystemProvider.tsx`
- Test: corresponding `*.test.tsx` and `frontend/src/hooks/useTheme.test.tsx`

**Interfaces:**
- Produces `ThemeProvider`, `useFeedback`, `PageHeader`, `SectionCard`, `StatCard`, `PrintPreviewFrame` and `RouteState` without Ant.
- Preserves the existing `FeedbackApi.notify(FeedbackMessage)` call contract.

- [ ] **Step 1: Rewrite provider tests to require Sonner and local theme classes**

Assert that notification levels call `toast.success`, `toast.info`, `toast.warning` and `toast.error`; assert that `ThemeProvider` toggles `document.documentElement.classList` and semantic variables without `ConfigProvider`.

- [ ] **Step 2: Run focused tests and verify they fail against Ant providers**

Run: `npm run test -- FeedbackProvider useTheme InstitutionalComponents PageHeader RouteState App`

Expected: FAIL on Sonner/local-provider expectations.

- [ ] **Step 3: Implement the stable feedback adapter**

Use this level mapping in `FeedbackProvider.tsx`:

```ts
const notifyByLevel = {
  success: toast.success,
  info: toast.info,
  warning: toast.warning,
  error: toast.error,
} satisfies Record<FeedbackLevel, (message: string, options?: { id?: string }) => unknown>;

const api: FeedbackApi = {
  notify: ({ key, level, message }) => notifyByLevel[level](message, { id: key }),
};
```

Render a single `<Toaster richColors closeButton position="top-right" />` at the application provider boundary.

- [ ] **Step 4: Replace shared Ant patterns with full shadcn composition**

Use `CardHeader/CardTitle/CardDescription/CardContent/CardFooter`, `Alert`, `Empty`, `Skeleton`, `Spinner` and `Button`. Preserve headings, `aria-live`, action labels and public props so downstream migrations remain isolated.

- [ ] **Step 5: Replace the app provider boundary**

The root composition becomes:

```tsx
<QueryClientProvider client={queryClient}>
  <ThemeProvider>
    <FeedbackProvider>
      <BrowserRouter>
        <AppErrorBoundary><HospitalApp /></AppErrorBoundary>
      </BrowserRouter>
    </FeedbackProvider>
  </ThemeProvider>
</QueryClientProvider>
```

- [ ] **Step 6: Run shared tests and quality gates**

Run:

```powershell
npm run test -- FeedbackProvider useTheme InstitutionalComponents PageHeader RouteState App
npm run typecheck
npm run lint
npm run build
```

Expected: PASS and zero Ant imports under `src/design-system/providers`, `src/design-system/components` and `src/design-system/patterns`.

- [ ] **Step 7: Commit shared patterns**

```powershell
git add frontend/src/App.tsx frontend/src/design-system frontend/src/hooks/useTheme.ts frontend/src/hooks/useTheme.test.tsx
git commit -m "refactor(ui): migrate shared patterns to shadcn"
```

### Task 3: Migrate shell, navigation, onboarding and authentication

**Files:**
- Modify: `frontend/src/shell/InstitutionalShell.tsx`
- Modify: `frontend/src/shell/navigation/*.tsx`
- Modify: `frontend/src/shell/status/ContextBar.tsx`
- Modify: `frontend/src/components/keyboard-shortcuts-palette.tsx`
- Modify: `frontend/src/components/PermissionGate.tsx`
- Modify: `frontend/src/components/AppErrorBoundary.tsx`
- Modify: `frontend/src/features/onboarding/GuidedTour.tsx`
- Modify: `frontend/src/features/auth/LoginView.tsx`
- Modify: `frontend/src/features/auth/PasswordChangeView.tsx`
- Modify: `frontend/src/layout/components/UserMenu.tsx`
- Test: existing shell, authentication, onboarding and accessibility tests

**Interfaces:**
- Preserves route definitions, permission filtering, `Ctrl/Cmd+K`, rail preference key, logout callback and guided-tour persistence.
- Produces an official shadcn Sidebar desktop shell and Sheet-based mobile navigation.

- [ ] **Step 1: Add assertions for shadcn shell behavior**

Tests must require `aria-current="page"`, accessible mobile Sheet title, command search, focus restoration, skip link, 44px primary targets and no Ant class names.

- [ ] **Step 2: Run the focused suite to establish red tests**

Run: `npm run test -- InstitutionalShell LoginView PasswordChangeView GuidedTour keyboard-shortcuts PermissionGate AppErrorBoundary`

Expected: FAIL on the new shadcn structure assertions.

- [ ] **Step 3: Compose the desktop and mobile shell**

Use `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarMenu`, `SidebarMenuButton`, `SidebarFooter` and `SidebarInset`. Use `Sheet` for mobile navigation and `CommandDialog` for navigation/shortcut palettes. Every overlay includes a title.

- [ ] **Step 4: Migrate authentication forms**

Use `FieldGroup`, `Field`, `FieldLabel`, `Input`, `Alert` and `Button`. Preserve controlled values and callbacks. Loading buttons use `Spinner data-icon="inline-start"` plus `disabled`; inputs expose `aria-invalid` and persistent errors.

- [ ] **Step 5: Verify shell and authentication**

Run:

```powershell
npm run test -- InstitutionalShell LoginView PasswordChangeView GuidedTour keyboard-shortcuts PermissionGate AppErrorBoundary
npm run typecheck
npm run lint
npx playwright test e2e/v1-2-visible-ui-a11y.spec.ts --grep "login|navigation|shell"
```

Expected: PASS, including axe and 320/390px viewport assertions.

- [ ] **Step 6: Commit shell and auth**

```powershell
git add frontend/src/shell frontend/src/components frontend/src/features/auth frontend/src/features/onboarding frontend/src/layout/components/UserMenu.tsx
git commit -m "refactor(ui): migrate shell and authentication to shadcn"
```

### Task 4: Migrate billing, payments and every receipt surface

**Files:**
- Modify: `frontend/src/features/invoices/NewInvoiceView.tsx`
- Modify: `frontend/src/features/invoices/components/*.tsx`
- Modify: `frontend/src/features/invoices/hooks/useIssuedReceiptActions.ts`
- Modify: `frontend/src/features/receipts/*.tsx`
- Modify: `frontend/src/features/receipt-settings/**/*.tsx`
- Modify: `frontend/src/printing/styles/receipt-print.css`
- Test: invoice, payment, receipt, printing and accessibility tests

**Interfaces:**
- Preserves invoice reducer, payload generation, server preview totals, idempotent submission, payment outcome handling and receipt snapshot APIs.
- Produces explicit print/download/reprint actions and paper-correct semantic receipt markup.

- [ ] **Step 1: Strengthen behavior and receipt characterization tests before markup changes**

Add assertions that patient name, saved service names/prices, subtotal, ISV, total, payment method, cashier and date come from the issued receipt snapshot. Assert no `/qr|barcode|internal code|codigo interno/i` content, no automatic `window.print`, and distinct original/copy labels.

- [ ] **Step 2: Run critical billing tests and verify only new structure tests fail**

Run:

```powershell
npm run test -- NewInvoiceView PaymentModal InvoiceCart InvoiceConfirmation InvoiceSuccess ReceiptPreview InstitutionalReceiptPreviewFrame InstitutionalReceiptSettings InstitutionalReceiptFlow receipt-print-css
```

Expected: existing business tests remain green; new shadcn/receipt layout assertions fail.

- [ ] **Step 3: Migrate the billing workspace**

Use shadcn fields, `Combobox`/`Command` search, `Table` for the cart, `Sheet` for the account panel, `Dialog` for payment/confirmation/success, `AlertDialog` for sensitive cancellation and responsive bottom actions. Preserve every handler and server-derived total.

- [ ] **Step 4: Migrate receipt settings and saved receipt UI**

Use `Tabs`, `Card`, `FieldGroup`, `Select`, `Checkbox`, `Collapsible`, `Alert` and `PrintPreviewFrame`. Historical receipt views must receive the persisted snapshot object unchanged.

- [ ] **Step 5: Redesign printable receipt markup and CSS**

The print document structure is:

```tsx
<article className="institutional-receipt" data-paper={paper} data-copy={copyKind}>
  <header className="receipt-header">{identity}</header>
  <section className="receipt-document-meta">{numberAndDate}</section>
  <section className="receipt-patient">{patientName}</section>
  <table className="receipt-items">{itemRows}</table>
  <section className="receipt-totals">{snapshotTotals}</section>
  <section className="receipt-payment">{snapshotPayment}</section>
  <footer className="receipt-signature">{signatureAndStamp}</footer>
</article>
```

Define explicit `@page` and geometry rules for `letter`, `half_letter` and `a5`; retain isolated secondary rules for `80mm` and `58mm`. Do not import application component styles into print CSS.

- [ ] **Step 6: Verify billing and receipt flows**

Run:

```powershell
npm run test -- NewInvoiceView PaymentModal InvoiceCart InvoiceConfirmation InvoiceSuccess ReceiptPreview InstitutionalReceiptPreviewFrame InstitutionalReceiptSettings InstitutionalReceiptFlow receipt-print-css
npm run typecheck
npm run lint
npx playwright test e2e/refactor-total.spec.ts --grep "invoice|payment|receipt|print"
```

Expected: PASS for normal invoice, erythropoietin with/without dialysis prescription, total/partial payment and explicit Letter/Half Letter/A5 printing.

- [ ] **Step 7: Commit billing and receipts**

```powershell
git add frontend/src/features/invoices frontend/src/features/receipts frontend/src/features/receipt-settings frontend/src/printing
git commit -m "refactor(billing): migrate invoicing and receipts to shadcn"
```

### Task 5: Migrate cash operations and invoice history

**Execution prerequisite:** Complete Task 6 first so cash movements and invoice history migrate directly to the final TanStack DataTable instead of creating a temporary table layer.

**Files:**
- Modify: `frontend/src/features/cash/**/*.tsx`
- Modify: `frontend/src/features/invoices/InvoiceHistoryView.tsx`
- Modify: `frontend/src/features/invoices/history/*.tsx`
- Test: `CashBoxView`, close/open session, movements, history and detail tests

**Interfaces:**
- Preserves cash-session queries, opening/closing payloads, denomination math, difference reasons, invoice actions and permissions.
- Uses the shared DataTable only after Task 6 lands; until then use shadcn semantic Table behind the same column model or execute Task 6 before completing history tables.

- [ ] **Step 1: Add failing interaction assertions**

Require inline field errors, disabled duplicate close/payment actions, accessible detail Sheet, responsive amount summaries and status Badges without Ant classes.

- [ ] **Step 2: Run cash and history tests**

Run: `npm run test -- CashBoxView CashClosingPanel CashMovementsTable OpenSessionForm InvoiceHistoryView InvoiceHistoryTable InvoiceDetailDrawer`

Expected: FAIL only on new shadcn structure assertions.

- [ ] **Step 3: Migrate cash forms and summaries**

Compose `Card`, `Badge`, `Alert`, `FieldGroup`, `Input`, `Dialog`, `Sheet`, `Tabs` and tabular amount blocks. Closing remains a guarded transaction initiated by one explicit submit.

- [ ] **Step 4: Migrate history filters, table actions and detail panel**

Use Field components, calendar popovers, Select, DataTable row actions and Sheet. Preserve URL/API filters, pagination and permission-derived action policy.

- [ ] **Step 5: Verify cash and history**

Run:

```powershell
npm run test -- CashBoxView CashClosingPanel CashMovementsTable OpenSessionForm InvoiceHistoryView InvoiceHistoryTable InvoiceDetailDrawer
npm run typecheck
npx playwright test e2e/refactor-total.spec.ts --grep "cash|history|reprint|close"
```

Expected: PASS for opening, payment association, reprint and closing with/without difference.

- [ ] **Step 6: Commit cash and history**

```powershell
git add frontend/src/features/cash frontend/src/features/invoices/InvoiceHistoryView.tsx frontend/src/features/invoices/history
git commit -m "refactor(cash): migrate cash and invoice history to shadcn"
```

### Task 6: Replace AG Grid with the institutional TanStack DataTable

**Files:**
- Create: `frontend/src/design-system/patterns/DataTable.tsx`
- Create: `frontend/src/design-system/patterns/DataTable.test.tsx`
- Create: `frontend/src/design-system/patterns/DataTable.stories.tsx`
- Modify: all consumers returned by `rg -l 'InstitutionalDataGrid|ag-grid' frontend/src`
- Delete: `frontend/src/design-system/ag-grid/`

**Interfaces:**
- Produces the `InstitutionalColumn<TData>` and `DataTable` signatures declared in the file map.
- Supports controlled server pagination, sorting/filtering hooks, column visibility, responsive priorities and row actions.

- [ ] **Step 1: Write failing DataTable contract tests**

Cover ready/loading/empty/error, sortable header, optional-column visibility, row actions, pagination callbacks, numeric alignment and keyboard focus.

- [ ] **Step 2: Run the contract test**

Run: `npm run test -- DataTable.test.tsx`

Expected: FAIL because `DataTable.tsx` does not exist.

- [ ] **Step 3: Install TanStack Table and implement the typed composition**

Run: `npm install @tanstack/react-table`

Build `useReactTable` with `getCoreRowModel`, optional `getSortedRowModel`, `getFilteredRowModel` and controlled/manual pagination. Render official shadcn Table primitives, Skeleton rows, Empty state and Pagination. Apply priority data attributes instead of AG-specific cell classes.

- [ ] **Step 4: Migrate every grid consumer**

Convert AG `ColDef` fields as follows:

```ts
{ field: 'patient', headerName: 'Paciente', cellRenderer: renderPatient }
// becomes
{ id: 'patient', accessorKey: 'patient', header: 'Paciente', cell: ({ row }) => renderPatient(row.original), priority: 'primary' }
```

Convert value formatters to `cell`, action renderers to DropdownMenu/Button compositions and external pagination to controlled DataTable props.

- [ ] **Step 5: Prove AG Grid has zero consumers and remove it**

Run: `rg -n 'ag-grid|InstitutionalDataGrid' frontend/src frontend/package.json`

Expected before deletion: only the legacy adapter/package entries. Delete the adapter and remove `ag-grid-community` and `ag-grid-react` with `npm uninstall` only after all consumers pass.

- [ ] **Step 6: Verify tables**

Run:

```powershell
npm run test -- DataTable UsersTable BackupHistoryTable CashMovementsTable ServiceCatalogTable InvoiceHistoryTable CashSessionReportPanel PendingAgingPanel ServiceRanking ReportsAudit
npm run typecheck
npm run lint
npm run build
```

Expected: PASS and `rg -n 'ag-grid' frontend/src frontend/package.json` returns no matches.

- [ ] **Step 7: Commit table convergence**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/src/design-system frontend/src/features
git commit -m "refactor(ui): replace ag grid with tanstack table"
```

### Task 7: Replace ECharts and migrate all report surfaces

**Files:**
- Create: `frontend/src/design-system/patterns/InstitutionalChart.tsx`
- Create: `frontend/src/design-system/patterns/InstitutionalChart.test.tsx`
- Modify: `frontend/src/features/reports/**/*.tsx`
- Modify: `frontend/src/modules/reports/**/*.tsx`
- Delete: `frontend/src/design-system/echarts/`

**Interfaces:**
- Produces the `InstitutionalChartProps` contract declared in the file map.
- Preserves report filters, server totals, export actions and accessible alternative tables.

- [ ] **Step 1: Write failing chart accessibility and state tests**

Require label, summary, alternative table, loading/empty/error states, token-based series colors and reduced-motion behavior.

- [ ] **Step 2: Run chart and report tests**

Run: `npm run test -- InstitutionalChart TrendChart PaymentMethodPanel ReportsExecutive ReportsCash ReportsAudit`

Expected: FAIL because the Recharts wrapper does not exist.

- [ ] **Step 3: Implement the Recharts wrapper**

Compose the official shadcn `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` and `ChartLegend`. Render the alternative table next to an `sr-only` summary or visible disclosure, never omit it.

- [ ] **Step 4: Convert chart options to declarative Recharts**

Trend becomes `ResponsiveContainer > LineChart > CartesianGrid + XAxis + YAxis + Tooltip + Line`. Payment methods become `BarChart` or `PieChart` with a visible legend and the existing table. Use the report payload without recalculation.

- [ ] **Step 5: Migrate remaining report controls**

Replace Ant DatePicker/Form/Select/Statistic/Alert/Empty/Spin with shadcn fields, Calendar popovers, Cards, Alerts, Empty and Skeleton/Spinner. Preserve export permissions and query parameters.

- [ ] **Step 6: Prove ECharts has zero consumers and remove it**

Run: `rg -n 'echarts|InstitutionalChart' frontend/src frontend/package.json`

Expected before deletion: new institutional chart references plus only the legacy ECharts adapter/package. Delete the legacy adapter and run `npm uninstall echarts`.

- [ ] **Step 7: Verify reports and charts**

Run:

```powershell
npm run test -- InstitutionalChart TrendChart PaymentMethodPanel ReportsExecutive ReportsCash ReportsAudit
npm run typecheck
npm run lint
npm run build
npx playwright test e2e/refactor-total.spec.ts --grep "report|chart|export"
```

Expected: PASS and `rg -n "from 'echarts'|from \"echarts\"" frontend/src` returns no matches.

- [ ] **Step 8: Commit report convergence**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/src/design-system frontend/src/features/reports frontend/src/modules/reports
git commit -m "refactor(reports): replace echarts with recharts"
```

### Task 8: Migrate catalog, dashboard, administration, settings, backups and support

**Files:**
- Modify: `frontend/src/features/catalog/**/*.tsx`
- Modify: `frontend/src/features/dashboard/**/*.tsx`
- Modify: `frontend/src/features/admin/**/*.tsx`
- Modify: `frontend/src/features/settings/**/*.tsx`
- Modify: `frontend/src/features/backups/**/*.tsx`
- Modify: `frontend/src/features/support/**/*.tsx`
- Modify: `frontend/src/features/help/HelpView.tsx`
- Modify: `frontend/src/features/about/AboutView.tsx`
- Modify: `frontend/src/modules/accounting/**/*.tsx`
- Test: all corresponding focused suites

**Interfaces:**
- Preserves catalog schemas, service/category mutations, fiscal guards, role/permission policies, backup actions and operational status APIs.
- Consumes shared shadcn patterns, DataTable and feedback APIs from prior tasks.

- [ ] **Step 1: Add module-level no-Ant architecture tests**

For each migrated directory, read production TSX files and assert they contain no `from 'antd'` or `@ant-design/icons`. Keep behavior assertions for permissions, validation and action availability.

- [ ] **Step 2: Run the administrative focused suite to establish failures**

Run:

```powershell
npm run test -- CatalogView DashboardView UsersView FiscalSettings BackupsView SupportCenterView HelpView AboutView
```

Expected: behavior tests pass and the new no-Ant assertions fail.

- [ ] **Step 3: Migrate catalog and dashboard**

Use DataTable, FieldGroup, Input, Select, Sheet, AlertDialog, Cards, Badges and Skeletons. Preserve audited price-change reasons, erythropoietin flags and dashboard permission filtering.

- [ ] **Step 4: Migrate users, permissions and settings**

Use Dialog/AlertDialog, DataTable, Checkbox groups, Fields, Tabs and Cards. Preserve protection against disabling the last administrator, self-escalation restrictions, temporary-password rules and fiscal high-risk confirmation.

- [ ] **Step 5: Migrate backups, support, help and about**

Use Cards, Alerts, Empty, Accordion, Progress and explicit action buttons. Never expose filesystem paths, hashes or commands to ordinary operators.

- [ ] **Step 6: Verify administrative modules**

Run:

```powershell
npm run test -- CatalogView DashboardView UsersView FiscalSettings BackupsView SupportCenterView HelpView AboutView
npm run typecheck
npm run lint
npx playwright test e2e/refactor-total.spec.ts --grep "catalog|users|settings|backup|help"
```

Expected: PASS and no Ant imports under the migrated directories.

- [ ] **Step 7: Commit remaining modules**

```powershell
git add frontend/src/features/catalog frontend/src/features/dashboard frontend/src/features/admin frontend/src/features/settings frontend/src/features/backups frontend/src/features/support frontend/src/features/help frontend/src/features/about frontend/src/modules/accounting
git commit -m "refactor(ui): migrate administration and support to shadcn"
```

### Task 9: Remove Ant Design and enforce final convergence

**Files:**
- Modify: `frontend/package.json`
- Merge: `frontend/package-lock.json`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/scripts/check-no-legacy-ui.mjs`
- Modify: `frontend/scripts/ui-legacy-audit.mjs`
- Modify: `frontend/scripts/check-ui-rules.mjs`
- Modify: architecture tests that previously required Ant
- Delete: remaining Ant provider/theme files and obsolete CSS

**Interfaces:**
- Produces a final quality gate with zero allowed imports of removed UI libraries.

- [ ] **Step 1: Run the final inventory and list every remaining consumer**

Run:

```powershell
rg -n "from ['\"]antd['\"]|@ant-design/icons|ag-grid|echarts|\.ant-" src package.json
npm run check:ui-legacy:final
```

Expected: any remaining match is a blocking failure and must be migrated, renamed or deleted; no broad allowlist is permitted.

- [ ] **Step 2: Remove obsolete packages**

Run: `npm uninstall antd @ant-design/icons ag-grid-community ag-grid-react echarts`

Expected: package and lock entries disappear while React, Tailwind, TanStack Table, Recharts, Radix/Lucide and Sonner remain direct dependencies.

- [ ] **Step 3: Delete legacy themes, selectors and architecture expectations**

Delete Ant ConfigProvider/theme code and `.ant-*` CSS. Change architecture tests to require shadcn imports and final zero-legacy results.

- [ ] **Step 4: Strengthen final guards**

`check:ui-legacy:final` must scan production TypeScript and CSS and fail on all removed imports/selectors. `check:ui-rules` must scan every shadcn/institutional component for raw brand colors, inaccessible overlays and forbidden remote assets.

- [ ] **Step 5: Run complete static and unit gates**

Run:

```powershell
npm run check:ui-legacy:final
npm run check:ui-rules
npm run typecheck
npm run lint
npm run test:segmented
npm run build
npm run budget:bundle
```

Expected: every command passes and repository search returns zero removed-library matches outside historical documentation.

- [ ] **Step 6: Commit final convergence**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/src frontend/scripts
git commit -m "refactor(ui): remove legacy ui libraries"
```

### Task 10: Certify responsive, accessible, offline and printed operation

**Files:**
- Modify: `frontend/e2e/refactor-total.spec.ts`
- Modify: `frontend/e2e/v1-2-visible-ui-a11y.spec.ts`
- Modify: receipt printing E2E/snapshot files under `frontend/e2e/`
- Modify: `docs/testing-report.md`
- Add: new QA evidence under a new migration-specific directory, not the user's pre-existing modified images

**Interfaces:**
- Produces evidence for every acceptance criterion in the approved design.

- [ ] **Step 1: Expand the maintained E2E matrix**

Cover login, password change, open cash, normal invoice, erythropoietin with/without prescription, total/partial payment, saved receipt, explicit Letter/Half Letter/A5 print, reprint reason, history, cancellation, close cash, reports, catalog, users, permissions and manual backup.

- [ ] **Step 2: Add responsive and axe assertions**

Run each critical screen at widths 320, 390, 768, 1024, 1366 and 1440. Assert `document.documentElement.scrollWidth <= window.innerWidth`, visible focus and zero axe violations.

- [ ] **Step 3: Add print-content and geometry assertions**

For Letter, Half Letter and A5 assert patient, invoice/receipt number, date, items, subtotal, ISV, total, payment, cashier, original/copy label, signature area and no QR/barcode/internal code. Verify first copy and reprint use the same financial snapshot.

- [ ] **Step 4: Run full frontend certification**

Run:

```powershell
npm run check:ui-legacy:final
npm run check:ui-rules
npm run typecheck
npm run lint
npm run test:coverage:check
npm run build
npm run budget:bundle
npm run test:e2e:mock
npm run build-storybook
```

Expected: all commands pass; coverage thresholds remain at least 65% lines/statements and 60% functions/branches.

- [ ] **Step 5: Run repository-wide and release-relevant checks**

Run from the repository root when Docker is available:

```powershell
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse
docker compose exec frontend npm run build
```

Expected: all services and checks pass without downloading runtime assets.

- [ ] **Step 6: Verify LAN/offline behavior manually in a controlled environment**

Disconnect external network access after build, open the app from a second LAN browser, login, create/pay a test invoice, open its saved receipt and print Letter/Half Letter/A5. Record environment, browser, viewport, printer/PDF target and observed result in `docs/testing-report.md`; do not claim hardware validation without evidence.

- [ ] **Step 7: Commit certification evidence**

```powershell
git add frontend/e2e docs/testing-report.md qa/shadcn-ui-migration
git commit -m "test(ui): certify total shadcn migration"
```

## Completion audit

Before marking the goal complete, inspect authoritative current state and require all of the following:

```powershell
rg -n "from ['\"]antd['\"]|@ant-design/icons|ag-grid|echarts|\.ant-" frontend/src frontend/package.json
git status --short
Set-Location frontend
npm run check:ui-legacy:final
npm run check:ui-rules
npm run typecheck
npm run lint
npm run test:coverage:check
npm run build
npm run budget:bundle
npm run test:e2e:mock
```

The first search must return no production/package matches. The dirty worktree may contain only explicitly preserved user changes or new evidence documented in the handoff. Review the dependency manifest, generated bundles, E2E results, print artifacts and testing report directly; a narrow green unit test is not sufficient proof of total migration.
