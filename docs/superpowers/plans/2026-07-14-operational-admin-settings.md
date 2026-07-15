# Operational Administration, Settings, Identity, Reports, and Backups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the primary administrative task in the first viewport, make institutional identity authentic or explicitly provisional, and apply the responsive grid contract to users, reports, and backups.

**Architecture:** Settings routes share one local navigation and compact status/action rows while retaining their existing forms and API contracts. A single `InstitutionalIdentity` component reads Branding settings and reserves a stable logo box. Administrative records use `InstitutionalDataGrid` on desktop and feature lists on mobile.

**Tech Stack:** React 19, TypeScript, Ant Design 6, Ant Design Icons, AG Grid Community, Apache ECharts, React Hook Form, Zod, TanStack Query, Laravel, Vitest, Playwright, axe.

## Global Constraints

- Canonical name: `Hospital General San Isidro`; location: `Tocoa, Colón, Honduras`.
- Use only a logo controlled by the hospital, Secretaría de Salud, or verifiable administrative documentation.
- If no verifiable file exists, use a typographic wordmark marked `Identidad provisional` and keep it replaceable from Branding.
- Keep all production assets local; no CDN or remote runtime request.
- Preserve settings, report, backup, role, permission, and audit contracts.
- Keep `borderRadius: 0`; add no second visual framework or temporary wrappers.

---

## File Map

- `docs/branding/HOSPITAL_IDENTITY_SOURCE.md`: asset provenance and verification record.
- `frontend/src/design-system/components/InstitutionalIdentity.tsx`: single logo/wordmark renderer.
- `frontend/src/features/settings/SettingsNavigation.tsx`: local settings sections.
- `frontend/src/features/settings/*View.tsx`: compact forms and conditional save bars.
- `frontend/src/features/admin/UsersView.tsx` and `components/UsersTable.tsx`: responsive users.
- `frontend/src/features/reports/*`: compact filters, accounting line, chart/table parity.
- `frontend/src/features/backups/BackupsView.tsx`: health/action first and responsive history.
- `frontend/e2e/settings-flow.spec.ts`, `users-flow.spec.ts`, `reports-flow.spec.ts`, `backups-flow.spec.ts`: browser evidence.

### Task 1: Verified or provisional institutional identity

**Files:**
- Create: `docs/branding/HOSPITAL_IDENTITY_SOURCE.md`
- Create: `frontend/src/design-system/components/InstitutionalIdentity.tsx`
- Create: `frontend/src/design-system/components/InstitutionalIdentity.test.tsx`
- Modify: `frontend/src/design-system/index.ts`
- Modify: `frontend/src/lib/hospital-name.ts`
- Modify: `frontend/src/features/settings/BrandingView.tsx`
- Modify: `frontend/src/features/settings/BrandingView.test.tsx`

**Interfaces:**
- `InstitutionalIdentityProps = { hospitalName: string; location: string; logoUrl?: string | null; provisional?: boolean; compact?: boolean }`.
- Branding API remains unchanged; missing logo produces provisional wordmark.

- [ ] **Step 1: Add failing canonical identity tests**

```tsx
it('uses the canonical institution and marks a missing logo provisional', () => {
  render(<InstitutionalIdentity hospitalName="Hospital General San Isidro" location="Tocoa, Colón, Honduras" provisional />);
  expect(screen.getByText('Hospital General San Isidro')).toBeVisible();
  expect(screen.getByText('Tocoa, Colón, Honduras')).toBeVisible();
  expect(screen.getByText('Identidad provisional')).toBeVisible();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('reserves a stable official-logo box', () => {
  render(<InstitutionalIdentity hospitalName="Hospital General San Isidro" location="Tocoa, Colón, Honduras" logoUrl="/api/branding/logo" />);
  expect(screen.getByRole('img', { name: /hospital general san isidro/i }).parentElement).toHaveClass('institutional-logo-box');
});
```

- [ ] **Step 2: Run and verify missing component failure**

Run: `cd frontend; npm.cmd exec vitest run src/design-system/components/InstitutionalIdentity.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Record provenance before importing an asset**

Search controlled hospital files, official Secretaría de Salud publications, and administrative documents. Record source owner, exact URL or local document path, retrieval date, file SHA-256, and verification result. Do not copy an asset when ownership or institution match is uncertain.

Use this exact fallback record when no asset is verified:

```md
## Resultado

- Estado: identidad provisional
- Logo oficial verificable: no localizado
- Activo usado: wordmark tipográfico local
- Reemplazo: panel Configuración > Marca, sin cambios de layout
- Solicitud pendiente al hospital: SVG o PNG oficial con autorización de uso
```

- [ ] **Step 4: Implement the identity component**

```tsx
export function InstitutionalIdentity({ hospitalName, location, logoUrl, provisional = !logoUrl, compact = false }: InstitutionalIdentityProps) {
  return (
    <div className="flex min-w-0 items-center gap-3" data-identity-state={provisional ? 'provisional' : 'verified'}>
      <div className="institutional-logo-box flex size-14 shrink-0 items-center justify-center border bg-white" aria-hidden={!logoUrl}>
        {logoUrl ? <img src={logoUrl} alt={hospitalName} className="max-h-full max-w-full object-contain" /> : <span className="font-semibold">HGSI</span>}
      </div>
      <div className="min-w-0"><strong className="block truncate">{hospitalName}</strong>{!compact && <span className="block text-sm text-secondary">{location}</span>}{provisional && <span className="block text-xs text-warning">Identidad provisional</span>}</div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests and commit**

Run: `cd frontend; npm.cmd exec vitest run InstitutionalIdentity BrandingView hospital-name`

Expected: PASS.

```powershell
git add docs/branding/HOSPITAL_IDENTITY_SOURCE.md frontend/src/design-system frontend/src/lib/hospital-name.ts frontend/src/features/settings/BrandingView.tsx frontend/src/features/settings/BrandingView.test.tsx
git commit -m "feat(branding): add replaceable institutional identity"
```

### Task 2: Compact settings workspace

**Files:**
- Create: `frontend/src/features/settings/SettingsNavigation.tsx`
- Create: `frontend/src/features/settings/SettingsNavigation.test.tsx`
- Modify: `frontend/src/features/settings/HospitalSettingsView.tsx`
- Modify: `frontend/src/features/settings/FiscalNumerationView.tsx`
- Modify: `frontend/src/features/settings/FiscalSettingsView.tsx`
- Modify: `frontend/src/features/settings/OperationalRulesView.tsx`
- Modify: corresponding `*.test.tsx`
- Modify: `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.tsx`

**Interfaces:**
- Settings navigation links: Hospital, Numeración, Operativa, Marca, Recibos.
- Each form exposes `data-dirty="true|false"`; save bar exists only when dirty.

- [ ] **Step 1: Add failing navigation/title test**

```tsx
it('shows one settings title and all local sections', () => {
  renderHospitalSettings();
  expect(screen.getAllByRole('heading', { level: 1, name: /configuración/i })).toHaveLength(1);
  const navigation = screen.getByRole('navigation', { name: /secciones de configuración/i });
  for (const label of ['Hospital', 'Numeración', 'Operativa', 'Marca', 'Recibos']) {
    expect(within(navigation).getByRole('link', { name: label })).toBeVisible();
  }
});
```

- [ ] **Step 2: Add failing dirty-save test**

```tsx
it('shows sticky save only after a change', async () => {
  renderHospitalSettings();
  expect(screen.queryByRole('button', { name: /guardar cambios/i })).not.toBeInTheDocument();
  await user.clear(screen.getByLabelText(/teléfono/i));
  await user.type(screen.getByLabelText(/teléfono/i), '2444-0000');
  expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeVisible();
});
```

- [ ] **Step 3: Implement local navigation**

Render an Ant Design `Tabs` or semantic `<nav>` sourced from actual routes; do not duplicate page cards. On mobile, use a Select whose value navigates to the same route.

- [ ] **Step 4: Normalize form layout and dirty save bars**

Use `formState.isDirty` from React Hook Form:

```tsx
{formState.isDirty ? (
  <div className="sticky bottom-0 z-20 flex justify-end border-t bg-surface p-3">
    <Button type="primary" htmlType="submit" loading={mutation.isPending}>Guardar cambios</Button>
  </div>
) : null}
```

Replace summary cards with compact `<dl>` or status rows. Remove duplicated H1/eyebrow pairs from child views.

- [ ] **Step 5: Run settings tests and commit**

Run: `cd frontend; npm.cmd exec vitest run src/features/settings src/features/receipt-settings`

Expected: PASS for all sections and dirty state.

```powershell
git add frontend/src/features/settings frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.tsx frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx
git commit -m "fix(settings): prioritize forms and conditional save"
```

### Task 3: Responsive users and permission actions

**Files:**
- Create: `frontend/src/features/admin/components/UsersList.tsx`
- Modify: `frontend/src/features/admin/UsersView.tsx`
- Modify: `frontend/src/features/admin/UsersView.test.tsx`
- Modify: `frontend/src/features/admin/components/UsersTable.tsx`
- Modify: `frontend/src/features/admin/components/UsersTable.test.tsx`
- Modify: `frontend/src/features/admin/components/UserActionMenu.tsx`

**Interfaces:**
- Desktop uses `InstitutionalDataGrid`; mobile uses `UsersList`.
- Visible actions are filtered by existing permission props; backend remains authoritative.

- [ ] **Step 1: Add failing responsive/permission tests**

```tsx
it('shows essential user records without document overflow on mobile', () => {
  setMatchMedia('(max-width: 767px)', true);
  renderUsers();
  expect(screen.getByRole('list', { name: /usuarios/i })).toBeVisible();
  expect(screen.queryByRole('grid')).not.toBeInTheDocument();
});

it('does not show unauthorized high-risk actions', () => {
  renderUsers({ canManageRoles: false, canDisableUsers: false });
  expect(screen.queryByRole('menuitem', { name: /roles/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: /desactivar/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend; npm.cmd exec vitest run UsersView UsersTable`

Expected: FAIL because the full grid is compressed or actions remain exposed.

- [ ] **Step 3: Implement users list and one paginator**

The list shows name, username, state, role summary, and one actions menu. Remove feature pagination if grid pagination is active. Preserve Drawer/Modal focus return.

- [ ] **Step 4: Run tests and commit**

Run: `cd frontend; npm.cmd exec vitest run src/features/admin`

Expected: PASS.

```powershell
git add frontend/src/features/admin
git commit -m "fix(users): add responsive authorized directory"
```

### Task 4: Reports with filters and table in the first viewport

**Files:**
- Modify: `frontend/src/features/reports/ReportsView.tsx`
- Modify: `frontend/src/features/reports/ReportsExecutive.tsx`
- Modify: `frontend/src/features/reports/ReportsCash.tsx`
- Modify: `frontend/src/features/reports/ReportsAudit.tsx`
- Modify: corresponding `*.test.tsx`
- Modify: `frontend/src/design-system/echarts/InstitutionalChart.tsx`

**Interfaces:**
- Preserve Ejecutivo, Caja, and Auditoría subroutes and export scope.
- Every chart has a heading, summary, and equivalent table/list from the same query data.

- [ ] **Step 1: Add failing first-viewport and parity tests**

```tsx
it('places report filters before summaries and charts', () => {
  renderExecutiveReport();
  const filters = screen.getByRole('search', { name: /filtros del reporte/i });
  const table = screen.getByRole('table', { name: /detalle ejecutivo/i });
  expect(filters.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('gives every chart an equivalent table', () => {
  renderExecutiveReport();
  for (const chart of screen.getAllByRole('img')) {
    expect(screen.getByRole('table', { name: new RegExp(chart.getAttribute('aria-label')!, 'i') })).toBeVisible();
  }
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend; npm.cmd exec vitest run ReportsView ReportsExecutive ReportsCash ReportsAudit`

Expected: FAIL when decorative summaries push filters/table or chart parity is absent.

- [ ] **Step 3: Recompose reports**

Use one compact filter toolbar, one accounting `<dl>` line, charts only for trend/distribution, and responsive records. The chart and table consume the same memoized dataset; exports continue using the same filter object sent to the backend.

- [ ] **Step 4: Run tests and commit**

Run: `cd frontend; npm.cmd exec vitest run src/features/reports src/design-system/echarts`

Expected: PASS with zero English and accessible chart summaries.

```powershell
git add frontend/src/features/reports frontend/src/design-system/echarts
git commit -m "fix(reports): surface filters and accessible evidence"
```

### Task 5: Backup health and history

**Files:**
- Create: `frontend/src/features/backups/BackupHistoryList.tsx`
- Modify: `frontend/src/features/backups/BackupsView.tsx`
- Modify: `frontend/src/features/backups/BackupsView.test.tsx`

**Interfaces:**
- Primary action is manual backup only when authorized.
- No restore/delete action appears without a safe backend contract.

- [ ] **Step 1: Add failing task-first tests**

```tsx
it('shows health and manual backup in the first operational region', () => {
  renderBackups({ canCreate: true });
  const header = screen.getByRole('region', { name: /estado de respaldos/i });
  expect(within(header).getByText(/último respaldo/i)).toBeVisible();
  expect(within(header).getByRole('button', { name: /crear respaldo/i })).toBeVisible();
});

it('does not invent unsafe restore or delete actions', () => {
  renderBackups({ canCreate: true });
  expect(screen.queryByRole('button', { name: /restaurar|eliminar/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend; npm.cmd exec vitest run BackupsView`

Expected: FAIL if decorative summaries precede the action or unsafe actions exist.

- [ ] **Step 3: Implement compact health and responsive history**

Use one status region for last run, next known run, result, and manual action. Use `InstitutionalDataGrid` on desktop and `BackupHistoryList` on mobile. Error details are sanitized and progressively disclosed.

- [ ] **Step 4: Run tests and commit**

Run: `cd frontend; npm.cmd exec vitest run src/features/backups`

Expected: PASS.

```powershell
git add frontend/src/features/backups
git commit -m "fix(backups): prioritize health and manual action"
```

### Task 6: Administration browser gate

**Files:**
- Modify: `frontend/e2e/settings-flow.spec.ts`
- Modify: `frontend/e2e/users-flow.spec.ts`
- Modify: `frontend/e2e/reports-flow.spec.ts`
- Modify: `frontend/e2e/backups-flow.spec.ts`
- Modify: `frontend/e2e/operational-ux-baseline.spec.ts`
- Create: `qa/operational-ux/admin-review.md`

- [ ] **Step 1: Add viewport invariants**

At 1366, 768, 390, and 320 px, assert zero document overflow, primary task in viewport, one paginator, no English, authorized actions only, and no sticky save bar before editing.

- [ ] **Step 2: Execute the focused gate**

```powershell
cd frontend
npm.cmd exec vitest run InstitutionalIdentity HospitalSettings FiscalNumeration OperationalRules Branding UsersView Reports Backups
npm.cmd run test:storybook
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd exec playwright test e2e/settings-flow.spec.ts e2e/users-flow.spec.ts e2e/reports-flow.spec.ts e2e/backups-flow.spec.ts e2e/operational-ux-baseline.spec.ts
```

Expected: PASS across settings, users, reports, backups, axe, and responsive checks.

- [ ] **Step 3: Inspect and document screenshots**

Record branding state/provenance, first-viewport task, overflow, sticky behavior, actions, truncation, localization, and chart/table parity in `qa/operational-ux/admin-review.md`.

- [ ] **Step 4: Commit**

```powershell
git add frontend/e2e qa/operational-ux/admin-review.md qa/operational-ux/after docs/branding/HOSPITAL_IDENTITY_SOURCE.md
git commit -m "test(admin): verify task-first responsive administration"
```
