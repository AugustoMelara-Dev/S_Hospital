# S_Hospital Total Rewrite Phase 1: Explicit Printing Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every automatic-print path and reduce the operator-facing receipt configuration to the three institutional paper choices managed by fixed internal profiles.

**Architecture:** The phase introduces the first `modules/receipts` policy boundary while keeping the current API and database compatible. Legacy thermal values remain readable for historical receipts, but only Carta, Media carta and A5 are selectable in the application. Receipt printing becomes an explicit audited command; no reducer state or component property can trigger it as a side effect.

**Tech Stack:** React 19, TypeScript 5, Vitest, Testing Library, TanStack Query, React Hook Form, Zod, Laravel 12, MariaDB.

## Global Constraints

- Production operation must remain fully offline on the hospital LAN.
- The backend remains the source of truth for totals, tax, authorization and receipt snapshots.
- Do not delete or reinterpret historical receipts using 80 mm or 58 mm compatibility profiles.
- The normal user chooses only Carta, Media carta or A5; margins, dimensions, fonts and scale are never exposed.
- Printing, downloading and reprinting require an explicit user action.
- Preserve the existing uncommitted coverage changes in `frontend/package.json`.
- Follow TDD: observe the focused test fail before production edits and pass afterward.

---

### Task 1: Remove automatic receipt printing

**Files:**
- Modify: `frontend/src/features/receipts/ReceiptPreview.test.tsx`
- Modify: `frontend/src/features/receipts/ReceiptPreview.tsx`
- Modify: `frontend/src/features/invoices/state/types.ts`
- Modify: `frontend/src/features/invoices/state/reducer.ts`
- Modify: `frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx`
- Modify: `frontend/src/features/invoices/components/NewInvoiceViewLayout.test.tsx`
- Modify: `frontend/src/features/invoices/components/NewInvoiceViewLayout.a11y.test.tsx`
- Modify: `frontend/src/features/invoices/NewInvoiceView.tsx`
- Test: `frontend/src/features/receipts/ReceiptPreview.test.tsx`
- Test: `frontend/src/features/invoices/state/reducer.test.ts`

**Interfaces:**
- Consumes: `ReceiptData`, `onPrint?: () => void | Promise<void>` and the existing explicit `Imprimir` button.
- Produces: `ReceiptPreviewProps` without `autoPrint`; `NewInvoiceState` and `NewInvoiceAction` without automatic-print state; printing occurs only through `handlePrintClick()`.

- [ ] **Step 1: Verify the existing regression test fails for the intended reason**

Run:

```powershell
npm.cmd run test -- ReceiptPreview.test.tsx -t "does not auto print" --pool=forks --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because `onPrint` is called once after the legacy `autoPrint` property is supplied.

- [ ] **Step 2: Remove the automatic-print effect from `ReceiptPreview`**

Change the imports and public contract to:

```tsx
import { useRef, useState } from 'react';

type ReceiptPreviewProps = {
  onNewInvoice?: () => void;
  onPrint?: () => void | Promise<void>;
  receipt: ReceiptData;
};

export function ReceiptPreview({ onNewInvoice, onPrint, receipt }: ReceiptPreviewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printError, setPrintError] = useState('');
```

Delete `autoPrintedReceiptRef` and the complete `useEffect` that calls
`handlePrintClick()` through `setTimeout`. Keep the explicit `Imprimir` button
and its audit callback unchanged.

- [ ] **Step 3: Remove automatic-print state from the invoice reducer**

Delete these members:

```ts
autoPrintReceipt: boolean;
{ type: 'SET_AUTO_PRINT_RECEIPT'; payload: boolean }
autoPrintReceipt: false,
```

Delete the reducer branch:

```ts
case 'SET_AUTO_PRINT_RECEIPT':
  return { ...state, autoPrintReceipt: action.payload };
```

- [ ] **Step 4: Remove automatic-print props and dispatches from invoice UI**

Render the compatibility preview with only explicit callbacks:

```tsx
<ReceiptPreview
  receipt={state.receipt}
  onNewInvoice={onNuevaFactura}
/>
```

Delete `onAutoPrintChange` from `NewInvoiceViewLayoutProps`, destructuring,
tests and the `NewInvoiceView` call. Delete every
`SET_AUTO_PRINT_RECEIPT` dispatch from `NewInvoiceView.tsx`.

- [ ] **Step 5: Verify no automatic-print production path remains**

Run:

```powershell
rg -n "autoPrint|SET_AUTO_PRINT_RECEIPT|autoPrintReceipt|onAutoPrintChange" frontend/src -g "*.ts" -g "*.tsx"
```

Expected: only the regression test's legacy-property injection contains
`autoPrint`; no production source contains any match.

- [ ] **Step 6: Run focused receipt and invoice state tests**

Run:

```powershell
npm.cmd run test -- ReceiptPreview.test.tsx NewInvoiceViewLayout.test.tsx NewInvoiceViewLayout.a11y.test.tsx reducer.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
```

Expected: all selected files pass.

- [ ] **Step 7: Run frontend static gates**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit the explicit-print contract**

```powershell
git add frontend/src/features/receipts/ReceiptPreview.test.tsx frontend/src/features/receipts/ReceiptPreview.tsx frontend/src/features/invoices/state/types.ts frontend/src/features/invoices/state/reducer.ts frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx frontend/src/features/invoices/components/NewInvoiceViewLayout.test.tsx frontend/src/features/invoices/components/NewInvoiceViewLayout.a11y.test.tsx frontend/src/features/invoices/NewInvoiceView.tsx
git commit -m "fix(printing): require explicit receipt printing"
```

### Task 2: Establish the institutional paper policy boundary

**Files:**
- Create: `frontend/src/modules/receipts/paperPolicy.ts`
- Create: `frontend/src/modules/receipts/paperPolicy.test.ts`
- Modify: `frontend/src/lib/institutionalReceiptPaper.ts`
- Modify: `frontend/src/lib/institutionalReceiptPaper.test.ts`
- Modify: `frontend/src/components/shared/design-system.tsx`
- Modify: `frontend/src/components/shared/design-system-additions.test.tsx`

**Interfaces:**
- Consumes: historical `ReceiptData['width']` values.
- Produces: `InstitutionalPaper = 'half_letter' | 'letter' | 'a5'`, `INSTITUTIONAL_PAPER_OPTIONS`, `normalizeInstitutionalPaper()` and `isLegacyThermalPaper()`.

- [ ] **Step 1: Write policy tests before the module exists**

Create:

```ts
import { describe, expect, it } from 'vitest';
import {
  INSTITUTIONAL_PAPER_OPTIONS,
  isLegacyThermalPaper,
  normalizeInstitutionalPaper,
} from './paperPolicy';

describe('institutional receipt paper policy', () => {
  it('offers only the three institutional paper choices', () => {
    expect(INSTITUTIONAL_PAPER_OPTIONS).toEqual([
      { value: 'letter', label: 'Carta' },
      { value: 'half_letter', label: 'Media carta' },
      { value: 'a5', label: 'A5' },
    ]);
  });

  it('falls back safely and identifies historical thermal values', () => {
    expect(normalizeInstitutionalPaper('ticket-roll')).toBe('half_letter');
    expect(normalizeInstitutionalPaper('80mm')).toBe('half_letter');
    expect(isLegacyThermalPaper('80mm')).toBe(true);
    expect(isLegacyThermalPaper('58mm')).toBe(true);
    expect(isLegacyThermalPaper('letter')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```powershell
npm.cmd run test -- paperPolicy.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because `paperPolicy.ts` does not exist.

- [ ] **Step 3: Implement the policy module**

Create:

```ts
export const INSTITUTIONAL_PAPER_OPTIONS = [
  { value: 'letter', label: 'Carta' },
  { value: 'half_letter', label: 'Media carta' },
  { value: 'a5', label: 'A5' },
] as const;

export type InstitutionalPaper = (typeof INSTITUTIONAL_PAPER_OPTIONS)[number]['value'];

const HISTORICAL_THERMAL_VALUES = new Set(['80mm', '58mm']);

export function isLegacyThermalPaper(value: unknown): boolean {
  return typeof value === 'string' && HISTORICAL_THERMAL_VALUES.has(value);
}

export function normalizeInstitutionalPaper(value: unknown): InstitutionalPaper {
  const match = INSTITUTIONAL_PAPER_OPTIONS.find((option) => option.value === value);
  return match?.value ?? 'half_letter';
}
```

- [ ] **Step 4: Make the legacy helper delegate to the policy**

`INSTITUTIONAL_RECEIPT_PAPER_OPTIONS` must export only the three policy
options. `institutionalReceiptPaperSize()` must normalize through
`normalizeInstitutionalPaper()`. Update its test to assert the three public
values and explicit safe fallback for 80 mm and 58 mm.

- [ ] **Step 5: Remove thermal options from the shared selector catalog**

Set `PAPER_PROFILES` to:

```ts
export const PAPER_PROFILES: readonly PaperProfile[] = [
  { code: 'carta', label: 'Carta', size: '216 × 279 mm', description: 'Documento completo' },
  { code: 'media_carta', label: 'Media carta', size: '216 × 140 mm', description: 'Recibo institucional' },
  { code: 'a5', label: 'A5', size: '148 × 210 mm', description: 'Formato compacto' },
];
```

Narrow `PaperProfile['code']` to `'carta' | 'media_carta' | 'a5'` and update
the shared selector test to assert that thermal radio options cannot render.

- [ ] **Step 6: Run policy and shared selector tests**

```powershell
npm.cmd run test -- paperPolicy.test.ts institutionalReceiptPaper.test.ts design-system-additions.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism
```

Expected: all selected tests pass.

### Task 3: Remove technical receipt controls from the application route

**Files:**
- Modify: `frontend/src/AppRoutes.tsx`
- Modify: `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.tsx`
- Modify: `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx`
- Modify: `frontend/src/features/receipt-settings/receiptSettings.schema.ts`
- Delete: `frontend/src/features/receipt-settings/receiptSettings.schema.test.ts`
- Modify: `frontend/src/lib/api/types.ts`

**Interfaces:**
- Consumes: existing safe receipt settings payload and the existing profile update endpoint.
- Produces: `InstitutionalReceiptSettingsViewProps = { canEdit: boolean; onStatus(message: string): void }`; no application component accepts an advanced-print permission or submits physical dimensions.

- [ ] **Step 1: Replace advanced-support tests with a permanent absence contract**

Remove tests that activate support mode or save manual dimensions. Add:

```tsx
it('never exposes or submits technical print controls for any application user', async () => {
  const { apiClient } = await import('@/lib/api');
  renderView();
  await activateTab('Papel y copias');

  expect(screen.getAllByRole('radio')).toHaveLength(3);
  expect(screen.queryByText(/modo soporte/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/ancho mm/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/margen/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/fuente/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/escala/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('radio', { name: /^Carta\b/i }));
  fireEvent.click(screen.getByRole('button', { name: /guardar perfil/i }));

  await waitFor(() => expect(apiClient.updateReceiptPrintProfile).toHaveBeenCalled());
  const [, payload] = vi.mocked(apiClient.updateReceiptPrintProfile).mock.calls.at(-1) ?? [];
  expect(payload).not.toEqual(expect.objectContaining({
    width_mm: expect.anything(),
    margin_top_mm: expect.anything(),
    font_family: expect.anything(),
    font_scale: expect.anything(),
  }));
});
```

- [ ] **Step 2: Run the new absence test and confirm RED**

Run:

```powershell
npm.cmd run test -- InstitutionalReceiptSettingsView.test.tsx -t "never exposes or submits technical" --pool=forks --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL while support mode remains reachable for privileged users.

- [ ] **Step 3: Delete the advanced UI contract**

Change the props to:

```ts
type InstitutionalReceiptSettingsViewProps = {
  canEdit: boolean;
  onStatus: (message: string) => void;
};
```

Delete `canAdvancedPrintSettings`, `advancedOpen`, `advancedSupported`,
`advancedSavingRef`, `advancedForm`, the advanced mutation, support-only profile
selection, support warnings and advanced panel markup. Filter selectable
profiles to `carta_horizontal`, `media_carta_horizontal` and `a5_horizontal`.

- [ ] **Step 4: Remove the route permission prop and frontend advanced schema**

Render:

```tsx
<InstitutionalReceiptSettingsView
  canEdit={user.permissions.includes('receipt_settings.update')}
  onStatus={onStatus}
/>
```

Delete `receiptProfileAdvancedSchema`, `ReceiptProfileAdvancedForm` and their
test. Keep technical response fields optional in the API type only for backward
read compatibility; the UI must not use or submit them.

- [ ] **Step 5: Run receipt settings and route tests**

```powershell
npm.cmd run test -- InstitutionalReceiptSettingsView.test.tsx App.test.tsx AppRoutes.lazy.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000
```

Expected: all selected tests pass and no test refers to support activation.

- [ ] **Step 6: Verify technical controls are absent from application code**

```powershell
rg -n "canAdvancedPrintSettings|receiptProfileAdvancedSchema|advancedOpen|support_reason|margin_top_mm|font_scale" frontend/src/features frontend/src/AppRoutes.tsx
```

Expected: no application UI match. Optional transport fields may remain only in
`frontend/src/lib/api/types.ts` for legacy response compatibility.

### Task 4: Close Phase 1 with complete frontend evidence

**Files:**
- Modify: `docs/testing-report.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/print-profiles.md`

**Interfaces:**
- Consumes: fresh command output from Tasks 1–3.
- Produces: current release evidence and operator documentation matching the new explicit-print contract.

- [ ] **Step 1: Update operator documentation**

Document exactly:

```text
El usuario selecciona Carta, Media carta o A5. El sistema aplica el perfil
institucional completo. No existe autoimpresión ni configuración de márgenes,
fuentes, medidas o escala dentro de la aplicación.
```

Keep 80 mm and 58 mm in a historical compatibility section only.

- [ ] **Step 2: Run the complete frontend suite**

```powershell
npm.cmd run test -- --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000
```

Expected: all test files and tests pass with zero failures.

- [ ] **Step 3: Run complete frontend gates**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Record exact evidence**

Add the command, date, pass/fail result, test counts and build chunk summary to
`docs/testing-report.md`. Add a Phase 1 entry to `CHANGELOG.md` describing the
removed auto-print behavior and locked paper choices.

- [ ] **Step 5: Commit Phase 1 policy and documentation**

```powershell
git add frontend/src/modules/receipts frontend/src/lib/institutionalReceiptPaper.ts frontend/src/lib/institutionalReceiptPaper.test.ts frontend/src/components/shared/design-system.tsx frontend/src/components/shared/design-system-additions.test.tsx frontend/src/AppRoutes.tsx frontend/src/features/receipt-settings frontend/src/lib/api/types.ts docs/testing-report.md docs/print-profiles.md CHANGELOG.md frontend/package.json
git commit -m "refactor(receipts): lock institutional printing profiles"
```
