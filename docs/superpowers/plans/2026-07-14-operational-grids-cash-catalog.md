# Operational Grids, Invoice History, Cashbox, and Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give invoice history, cashbox, and catalog one localized pagination model, responsive records, accessible details, and their primary work in the first viewport.

**Architecture:** `InstitutionalDataGrid` owns AG Grid locale, sizing, empty height, and desktop pagination. Features supply column definitions and server pagination metadata; below the feature breakpoint they render domain-specific semantic lists instead of a compressed grid. Drawers preserve full references and actions.

**Tech Stack:** React 19, TypeScript, Ant Design 6, AG Grid Community 36, Day.js, TanStack Query, Vitest, Playwright, axe.

## Global Constraints

- Preserve API contracts, permissions, audit rules, and invoice immutability.
- Use one paginator only; do not render an Ant Design paginator with AG Grid pagination.
- Use Spanish (Honduras) for UI, dates, times, states, and grid controls.
- Produce zero document horizontal overflow at 1366 px and all required smaller viewports.
- Keep global `borderRadius: 0` and add no visual framework or wrapper generation.

---

## File Map

- `frontend/src/design-system/ag-grid/InstitutionalDataGrid.tsx`: grid contract and responsive handoff.
- `frontend/src/design-system/ag-grid/institutional-data-grid.css`: auto-height, numbers, and actions.
- `frontend/src/lib/i18n/agGridEsHN.ts`: complete AG Grid locale object.
- `frontend/src/features/invoices/history/InvoiceHistoryTable.tsx`: history columns/desktop grid.
- `frontend/src/features/invoices/history/InvoiceHistoryList.tsx`: mobile history records.
- `frontend/src/features/cash/components/CashMovementsTable.tsx`: desktop cash movements.
- `frontend/src/features/cash/components/CashMovementsList.tsx`: mobile cash movements.
- `frontend/src/features/catalog/components/ServiceCatalogTable.tsx`: desktop catalog.
- `frontend/src/features/catalog/components/ServiceCatalogList.tsx`: mobile catalog.
- Feature tests and E2E specs verify localization, pagination, overflow, and actions.

### Task 1: One institutional grid contract

**Files:**
- Create: `frontend/src/lib/i18n/agGridEsHN.ts`
- Modify: `frontend/src/design-system/ag-grid/InstitutionalDataGrid.tsx`
- Modify: `frontend/src/design-system/ag-grid/institutional-data-grid.css`
- Modify: `frontend/src/design-system/ag-grid/InstitutionalDataGrid.test.tsx`
- Modify: `frontend/src/design-system/ag-grid/InstitutionalDataGrid.stories.tsx`

**Interfaces:**
- `InstitutionalDataGridProps<T>` adds `totalRows`, `page`, `pageSize`, `onPageChange`, `mobileFallback`, and `autoHeightThreshold`.
- Produces one localized pagination surface and `data-pagination-owner="grid"`.

- [ ] **Step 1: Write failing locale and pagination tests**

```tsx
it('owns one Spanish pagination surface', () => {
  render(<InstitutionalDataGrid {...props} totalRows={30} page={1} pageSize={10} />);
  expect(screen.getAllByRole('navigation', { name: /paginación/i })).toHaveLength(1);
  expect(screen.queryByText(/page size/i)).not.toBeInTheDocument();
  expect(screen.getByText(/filas por página/i)).toBeVisible();
});

it('uses content height for a short result', () => {
  render(<InstitutionalDataGrid {...props} rows={[rowA, rowB]} autoHeightThreshold={8} />);
  expect(screen.getByTestId('institutional-grid')).toHaveAttribute('data-layout', 'autoHeight');
});
```

- [ ] **Step 2: Run and verify current failure**

Run: `cd frontend; npm.cmd exec vitest run src/design-system/ag-grid/InstitutionalDataGrid.test.tsx`

Expected: FAIL for English strings, duplicate owner, or fixed empty height.

- [ ] **Step 3: Implement the locale object**

```ts
export const agGridEsHN: Record<string, string> = {
  page: 'Página',
  more: 'Más',
  to: 'a',
  of: 'de',
  next: 'Siguiente',
  last: 'Última',
  first: 'Primera',
  previous: 'Anterior',
  loadingOoo: 'Cargando',
  noRowsToShow: 'Sin registros',
  pageSizeSelectorLabel: 'Filas por página',
  searchOoo: 'Buscar',
  selectAll: 'Seleccionar todo',
  blanks: 'Vacíos',
  filterOoo: 'Filtrar',
  equals: 'Igual a',
  notEqual: 'Distinto de',
  contains: 'Contiene',
  notContains: 'No contiene',
  startsWith: 'Empieza con',
  endsWith: 'Termina con',
};
```

- [ ] **Step 4: Implement grid ownership and short height**

Pass `localeText={agGridEsHN}` and `domLayout={rows.length <= autoHeightThreshold ? 'autoHeight' : 'normal'}`. When `totalRows` is provided, disable AG Grid client pagination and render one Ant Design paginator inside `InstitutionalDataGrid`:

```tsx
<Pagination
  aria-label="Paginación"
  current={page}
  total={totalRows}
  pageSize={pageSize}
  showSizeChanger
  showTotal={(total) => `${total} registros`}
  locale={{ items_per_page: 'filas por página', jump_to: 'Ir a', page: 'Página' }}
  onChange={onPageChange}
/>
```

Apply `suppressHorizontalScroll` only when feature columns are designed to fit. Remove feature-level pagination whenever `InstitutionalDataGrid` receives `totalRows`.

- [ ] **Step 5: Run tests/story and commit**

Run: `cd frontend; npm.cmd exec vitest run src/design-system/ag-grid/InstitutionalDataGrid.test.tsx; npm.cmd run test:storybook`

Expected: PASS with zero English grid strings.

```powershell
git add frontend/src/lib/i18n/agGridEsHN.ts frontend/src/design-system/ag-grid
git commit -m "fix(grids): centralize Spanish pagination and sizing"
```

### Task 2: Responsive invoice history

**Files:**
- Create: `frontend/src/features/invoices/history/InvoiceHistoryList.tsx`
- Modify: `frontend/src/features/invoices/history/InvoiceHistoryTable.tsx`
- Modify: `frontend/src/features/invoices/InvoiceHistoryView.tsx`
- Modify: `frontend/src/features/invoices/InvoiceHistoryView.test.tsx`
- Modify: `frontend/src/features/invoices/InvoiceHistoryView.continuity.test.tsx`
- Modify: `frontend/src/features/invoices/history/InvoiceDetailDrawer.tsx`

**Interfaces:**
- `InvoiceHistoryListProps = { invoices: Invoice[]; onOpen(invoice): void; renderActions(invoice): ReactNode }`.
- Desktop columns consume `formatDateTimeHN` and `LempiraAmount`.

- [ ] **Step 1: Add failing history requirements**

```tsx
it('renders one paginator and complete localized records', async () => {
  renderHistory({ invoices: [invoiceA, invoiceB], total: 2 });
  expect(screen.getAllByRole('navigation', { name: /paginación/i })).toHaveLength(1);
  expect(screen.queryByText(/page size/i)).not.toBeInTheDocument();
  expect(screen.getByText('14/7/2026, 8:00 a. m.')).toBeVisible();
  expect(screen.getByText(invoiceA.patient_name)).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend; npm.cmd exec vitest run src/features/invoices/InvoiceHistoryView.test.tsx src/features/invoices/InvoiceHistoryView.continuity.test.tsx`

Expected: FAIL for pagination duplication, date formatting, or truncated content.

- [ ] **Step 3: Implement desktop columns**

Use `flex: 2, minWidth: 180` for patient, fixed tabular widths for money, `pinned: 'right'` only when it does not create document overflow, and one actions menu with an accessible label containing the invoice number. Do not show receipt internal identifiers as primary table content.

- [ ] **Step 4: Implement mobile list**

```tsx
export function InvoiceHistoryList({ invoices, onOpen, renderActions }: InvoiceHistoryListProps) {
  return (
    <ul aria-label="Facturas" className="divide-y md:hidden">
      {invoices.map((invoice) => (
        <li key={invoice.id} className="grid gap-2 py-4">
          <button className="text-left" onClick={() => onOpen(invoice)}>
            <strong>{invoice.patient_name}</strong>
            <span className="block font-mono text-sm">{invoice.invoice_number}</span>
          </button>
          <div className="flex items-center justify-between"><LempiraAmount value={invoice.total} />{renderActions(invoice)}</div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Run tests and commit**

Run: `cd frontend; npm.cmd exec vitest run InvoiceHistoryView InvoiceHistoryTable InvoiceDetailDrawer`

Expected: PASS, with filter and scroll continuity preserved after Drawer close.

```powershell
git add frontend/src/features/invoices/InvoiceHistoryView.tsx frontend/src/features/invoices/InvoiceHistoryView.test.tsx frontend/src/features/invoices/InvoiceHistoryView.continuity.test.tsx frontend/src/features/invoices/history
git commit -m "fix(history): make invoices responsive and locally formatted"
```

### Task 3: Compact cashbox operation

**Files:**
- Create: `frontend/src/features/cash/components/CashMovementsList.tsx`
- Modify: `frontend/src/features/cash/CashBoxView.tsx`
- Modify: `frontend/src/features/cash/CashBoxView.test.tsx`
- Modify: `frontend/src/features/cash/components/SessionSummary.tsx`
- Modify: `frontend/src/features/cash/components/CashMovementsTable.tsx`
- Modify: `frontend/src/features/cash/components/CashMovementsTable.test.tsx`
- Modify: `frontend/src/features/cash/components/CashClosingPanel.tsx`
- Modify: `frontend/src/features/cash/components/CashClosingPanel.test.tsx`

**Interfaces:**
- Cash status header shows `status`, `opened_at`, `expected_cash_amount`, `pending_amount`, and allowed actions.
- Movement detail Drawer exposes the complete reference; tables/lists use `movementTypeLabel` from centralized `es-HN` translations.

- [ ] **Step 1: Add failing compact-header test**

```tsx
it('shows cash state and action in one operational header', () => {
  renderCashOpen();
  const header = screen.getByRole('region', { name: /estado de caja/i });
  expect(within(header).getByText(/caja abierta/i)).toBeVisible();
  expect(within(header).getByText(/efectivo esperado/i)).toBeVisible();
  expect(screen.queryByText(/conciliación operativa lista/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Add movement translation/detail tests**

```tsx
it('translates opening and exposes the complete reference', async () => {
  renderMovements([openingMovement]);
  expect(screen.getByText('Apertura')).toBeVisible();
  await user.click(screen.getByRole('button', { name: /ver detalle de apertura/i }));
  expect(screen.getByRole('dialog', { name: /detalle del movimiento/i })).toHaveTextContent(openingMovement.reference);
});
```

- [ ] **Step 3: Run and verify failure**

Run: `cd frontend; npm.cmd exec vitest run CashBoxView CashMovementsTable CashClosingPanel`

Expected: FAIL for redundant success alert, `opening`, or missing full reference.

- [ ] **Step 4: Implement compact summary and responsive movement views**

Replace stacked metric cards with a `<dl>` inside one region. Use `InstitutionalDataGrid` on desktop and `CashMovementsList` below 768 px. Keep only date, type, reference summary, method, and amount in the table; full metadata lives in an Ant Design Drawer.

- [ ] **Step 5: Place resolution links beside blockers**

Render each close blocker as:

```tsx
<li className="flex items-start justify-between gap-3 border-b py-3">
  <span>{blocker.message}</span>
  <Link to={blocker.historyUrl}>Resolver en historial</Link>
</li>
```

Remove the giant success alert when there are no blockers.

- [ ] **Step 6: Run tests and commit**

Run: `cd frontend; npm.cmd exec vitest run src/features/cash`

Expected: PASS.

```powershell
git add frontend/src/features/cash
git commit -m "fix(cashbox): compact session and movement workflow"
```

### Task 4: First-viewport catalog

**Files:**
- Create: `frontend/src/features/catalog/components/ServiceCatalogList.tsx`
- Modify: `frontend/src/features/catalog/CatalogView.tsx`
- Modify: `frontend/src/features/catalog/CatalogView.test.tsx`
- Modify: `frontend/src/features/catalog/components/CatalogToolbar.tsx`
- Modify: `frontend/src/features/catalog/components/CatalogPagination.tsx`
- Modify: `frontend/src/features/catalog/components/ServiceCatalogTable.tsx`
- Modify: `frontend/src/features/catalog/components/ServiceCatalogTable.test.tsx`

**Interfaces:**
- Catalog has one categories filter representation and one grid-owned paginator.
- Duplicate names are identified by category, area, and visible code.

- [ ] **Step 1: Add failing first-viewport and duplicate-name tests**

```tsx
it('places filters and records before decorative metrics', () => {
  renderCatalog();
  expect(screen.queryByText(/total catálogo/i)).not.toBeInTheDocument();
  expect(screen.getByRole('search', { name: /filtrar catálogo/i })).toBeVisible();
  expect(screen.getByRole('grid', { name: /servicios/i })).toBeVisible();
});

it('distinguishes services with the same name', () => {
  renderCatalog({ services: [labGlucose, imagingGlucose] });
  expect(screen.getByText('Laboratorio · Química · LAB-01')).toBeVisible();
  expect(screen.getByText('Imágenes · Ultrasonido · IMG-07')).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend; npm.cmd exec vitest run CatalogView ServiceCatalogTable`

Expected: FAIL because metric cards precede filters and metadata is compressed/truncated.

- [ ] **Step 3: Remove decorative metrics and duplicate category representation**

Delete total/category cards. Keep service count as one muted line in the toolbar. Categories exist only in the filter Select and record metadata; remove any second category navigation strip.

- [ ] **Step 4: Implement desktop/mobile record renderers**

Desktop uses flexible service name and metadata columns with a single actions menu. Mobile list markup:

```tsx
<li className="grid gap-2 border-b py-4">
  <div><strong>{service.name}</strong><span className="block text-sm text-secondary">{identityLine(service)}</span></div>
  <div className="flex items-center justify-between"><LempiraAmount value={service.price} /><ServiceActions service={service} /></div>
</li>
```

`identityLine` returns `[category.name, area?.name, internal_code ?? scan_code].filter(Boolean).join(' · ')` with duplicates removed case-insensitively.

- [ ] **Step 5: Remove feature pagination**

Delete `CatalogPagination` rendering when `InstitutionalDataGrid` owns the page. If no other caller remains, delete `CatalogPagination.tsx` and its imports rather than leaving a dead wrapper.

- [ ] **Step 6: Run tests and commit**

Run: `cd frontend; npm.cmd exec vitest run src/features/catalog`

Expected: PASS including Drawer accessibility and one paginator.

```powershell
git add frontend/src/features/catalog
git commit -m "fix(catalog): surface filters and responsive records"
```

### Task 5: Grid module browser gate

**Files:**
- Modify: `frontend/e2e/invoice-history-flow.spec.ts`
- Modify: `frontend/e2e/cashbox.spec.ts`
- Modify: `frontend/e2e/catalog-flow.spec.ts`
- Modify: `frontend/e2e/operational-ux-baseline.spec.ts`
- Create: `qa/operational-ux/grids-review.md`

- [ ] **Step 1: Add cross-module invariants**

For history, cash, and catalog at 1366, 768, 390, and 320 px, assert zero document overflow, exactly one paginator, zero `/page size/i`, visible actions, and mobile list presence below the breakpoint.

- [ ] **Step 2: Execute the focused gate**

```powershell
cd frontend
npm.cmd exec vitest run InstitutionalDataGrid InvoiceHistoryView CashBoxView CatalogView
npm.cmd run test:storybook
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd exec playwright test e2e/invoice-history-flow.spec.ts e2e/cashbox.spec.ts e2e/catalog-flow.spec.ts e2e/operational-ux-baseline.spec.ts
```

Expected: PASS at all selected viewports with one paginator and no English.

- [ ] **Step 3: Inspect screenshots and record evidence**

Record first-viewport task visibility, reference completeness, small-result height, actions, truncation, and horizontal overflow in `qa/operational-ux/grids-review.md`.

- [ ] **Step 4: Commit**

```powershell
git add frontend/e2e qa/operational-ux/grids-review.md qa/operational-ux/after
git commit -m "test(grids): verify responsive operational records"
```
