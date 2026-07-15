# Institutional Documents and Operational UX Release Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce authoritative institutional receipts in Carta, Media Carta, A5, 80 mm, and 58 mm, then prove every UX requirement through fresh tests, browser/PDF evidence, and visual review.

**Architecture:** `BuildInstitutionalReceiptSnapshotAction` remains the single content model. Backend Blade templates and frontend preview render the same named sections; paper profiles choose dedicated CSS/layouts rather than scaling Carta. A completion matrix maps each specification row to authoritative evidence and blocks final merge while any row is missing.

**Tech Stack:** Laravel, DomPDF/browser PDF pipeline, Blade, React 19, Ant Design 6, Playwright PDF, Vitest, Storybook, axe, Docker Compose.

## Global Constraints

- Main receipt exposes no QR, barcode, or internal service code.
- Carta, Media Carta, and A5 are primary; 80 mm and 58 mm are separate compatibility templates.
- Four services fit on one page in every primary paper profile when configured data is normal length.
- Preview and PDF use the same content model and institutional identity source.
- Preserve fiscal numbering, snapshots, payment, cashbox, copy, reprint, void, audit, and idempotency rules.
- Production remains offline; no CDN, cloud rendering, or remote asset.
- Keep global UI `borderRadius: 0`; do not hide failures by increasing timeouts.

---

## File Map

- `backend/app/Actions/InstitutionalReceipts/BuildInstitutionalReceiptSnapshotAction.php`: complete authoritative receipt data.
- `backend/app/Actions/InstitutionalReceipts/InstitutionalReceiptHtmlBuilder.php`: profile-to-template selection.
- `backend/resources/views/pdf/institutional-receipts/classic.blade.php`: primary administrative document structure.
- `backend/resources/views/pdf/institutional-receipts/thermal.blade.php`: independent 80/58 mm structure.
- `backend/tests/Feature/InstitutionalReceiptPdfTest.php`: content, page count, and forbidden data.
- `frontend/src/features/receipts/ReceiptPreview.tsx`: preview of snapshot sections.
- `frontend/src/printing/styles/receipt-print.css`: browser print profiles.
- `frontend/e2e/print-profiles.spec.ts`: browser/PDF parity and page geometry.
- `qa/operational-ux/completion-matrix.md`: requirement-to-evidence audit.
- `qa/operational-ux/final-comparison.md`: canonical twelve before/after review.

### Task 1: Complete receipt snapshot contract

**Files:**
- Modify: `backend/app/Actions/InstitutionalReceipts/BuildInstitutionalReceiptSnapshotAction.php`
- Modify: `backend/tests/Feature/InstitutionalReceiptPdfTest.php`
- Modify: `frontend/src/lib/api/institutionalReceipts.ts`
- Modify: `frontend/src/lib/api/types.ts`

**Interfaces:**
- Snapshot exposes `institution`, `document`, `patient`, `cashier`, `cash_session`, `items`, `totals`, `payment`, `copy`, `signature`, and `fiscal`.
- Money remains decimal strings; frontend does not recalculate totals.

- [ ] **Step 1: Add failing snapshot completeness test**

```php
public function test_receipt_snapshot_contains_every_administrative_section(): void
{
    $receipt = $this->paidReceiptWithFourServices();
    $snapshot = app(BuildInstitutionalReceiptSnapshotAction::class)->execute($receipt);

    $this->assertSame('Hospital General San Isidro', data_get($snapshot, 'institution.name'));
    $this->assertSame('Tocoa, Colón, Honduras', data_get($snapshot, 'institution.location'));
    foreach (['rtn', 'address', 'phone'] as $field) {
        $this->assertNotEmpty(data_get($snapshot, "institution.{$field}"));
    }
    foreach (['number', 'issued_at', 'status'] as $field) {
        $this->assertNotEmpty(data_get($snapshot, "document.{$field}"));
    }
    $this->assertNotEmpty(data_get($snapshot, 'patient.name'));
    $this->assertNotEmpty(data_get($snapshot, 'cashier.name'));
    $this->assertNotEmpty(data_get($snapshot, 'cash_session.label'));
    $this->assertCount(4, data_get($snapshot, 'items'));
    foreach (['subtotal', 'exempt', 'tax', 'total', 'amount_words'] as $field) {
        $this->assertArrayHasKey($field, data_get($snapshot, 'totals'));
    }
    $this->assertNotEmpty(data_get($snapshot, 'payment.method_label'));
    $this->assertNotEmpty(data_get($snapshot, 'copy.label'));
}
```

- [ ] **Step 2: Run and verify missing fields**

Run: `docker compose exec backend php artisan test --filter=InstitutionalReceiptPdfTest`

Expected: FAIL listing fields not currently in the snapshot.

- [ ] **Step 3: Extend the snapshot without recomputation**

Populate every field from persisted invoice item snapshots, payment, cash session, user, receipt settings, series, and receipt copy metadata. Use existing money/amount-in-words services; never read current service price/name for historical items.

The result shape must be explicit:

```php
return [
    'institution' => ['name' => $name, 'location' => $location, 'rtn' => $rtn, 'address' => $address, 'phone' => $phone, 'logo_url' => $logoUrl, 'identity_status' => $identityStatus],
    'document' => ['number' => $receipt->receipt_number_full, 'invoice_number' => $invoice->invoice_number, 'issued_at' => $receipt->issued_at, 'status' => $receipt->status],
    'patient' => ['name' => $invoice->patient_name],
    'cashier' => ['name' => $receipt->issuer->name],
    'cash_session' => ['label' => 'Caja #'.$receipt->cash_session_id],
    'items' => $items,
    'totals' => ['subtotal' => $invoice->subtotal, 'exempt' => $exempt, 'tax' => $invoice->tax, 'total' => $invoice->total, 'amount_words' => $receipt->amount_words],
    'payment' => ['method' => $payment->method, 'method_label' => $methodLabel, 'reference' => $payment->reference],
    'copy' => ['sequence' => $copySequence, 'label' => $copyLabel],
    'signature' => ['label' => 'Firma', 'stamp_label' => 'Sello'],
    'fiscal' => $fiscalData,
];
```

- [ ] **Step 4: Update TypeScript types and run contracts**

Run:

```powershell
docker compose exec backend php artisan test --filter='InstitutionalReceiptPdfTest|InstitutionalReceiptIssueTest|InstitutionalReceiptPaymentIntegrationTest'
cd frontend
npm.cmd exec vitest run src/lib/api/institutionalReceipts.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/Actions/InstitutionalReceipts/BuildInstitutionalReceiptSnapshotAction.php backend/tests/Feature/InstitutionalReceiptPdfTest.php frontend/src/lib/api/institutionalReceipts.ts frontend/src/lib/api/types.ts
git commit -m "feat(receipts): complete institutional snapshot contract"
```

### Task 2: Dedicated administrative and thermal templates

**Files:**
- Modify: `backend/resources/views/pdf/institutional-receipts/classic.blade.php`
- Create: `backend/resources/views/pdf/institutional-receipts/thermal.blade.php`
- Modify: `backend/app/Actions/InstitutionalReceipts/InstitutionalReceiptHtmlBuilder.php`
- Modify: `backend/app/Actions/InstitutionalReceipts/ResolveReceiptPrintProfileAction.php`
- Modify: `backend/tests/Feature/InstitutionalReceiptPdfTest.php`
- Modify: `backend/tests/Unit/ReceiptPaperProfileTest.php`

**Interfaces:**
- `classic.blade.php` supports existing `letter_landscape`, `half_letter_landscape`, and `a5_landscape` paper kinds.
- `thermal.blade.php` supports existing `thermal_80mm` and `thermal_58mm` paper kinds; it does not inherit scaled Carta CSS.

- [ ] **Step 1: Add failing page/template tests**

```php
/** @dataProvider primaryPaperProfiles */
public function test_four_service_receipt_is_one_page(string $profile): void
{
    $pdf = $this->renderPaidReceipt($profile, itemCount: 4);
    $this->assertSame(1, $this->pdfPageCount($pdf));
    $this->assertPdfContains($pdf, ['Subtotal', 'Exentos', 'ISV', 'Total', 'Firma', 'Sello']);
}

public function test_thermal_profiles_use_the_thermal_template(): void
{
    foreach (['thermal_80mm', 'thermal_58mm'] as $profile) {
        $html = $this->renderReceiptHtml($profile);
        $this->assertStringContainsString('data-template="thermal"', $html);
        $this->assertStringNotContainsString('data-template="administrative"', $html);
    }
}
```

- [ ] **Step 2: Run and verify page/template failure**

Run: `docker compose exec backend php artisan test --filter='InstitutionalReceiptPdfTest|ReceiptPaperProfileTest'`

Expected: FAIL where totals/signatures spill or thermal uses scaled administrative markup.

- [ ] **Step 3: Rebuild administrative markup**

Structure `classic.blade.php` as header, document metadata, patient/cash context, item table, totals, fiscal copy line, and signature footer. Apply profile-specific `@page` sizes/margins and `page-break-inside: avoid` to totals/signatures. Use administrative minimums: 9 pt body for Carta/Media Carta, 8.5 pt for A5; never shrink dynamically by item count.

- [ ] **Step 4: Create thermal markup**

Thermal uses stacked item lines and narrow totals, but the same snapshot fields. It omits only layout-impossible administrative decoration, never patient, document number, total, method, or fiscal requirements. No QR, barcode, or internal code.

- [ ] **Step 5: Run PDF tests and commit**

Run: `docker compose exec backend php artisan test --filter='InstitutionalReceiptPdfTest|ReceiptPaperProfileTest|InstitutionalReceiptPaymentIntegrationTest'`

Expected: PASS, one page for four services in primary profiles and separate thermal template selection.

```powershell
git add backend/resources/views/pdf/institutional-receipts backend/app/Actions/InstitutionalReceipts backend/tests/Feature/InstitutionalReceiptPdfTest.php backend/tests/Unit/ReceiptPaperProfileTest.php
git commit -m "feat(printing): add dedicated institutional paper templates"
```

### Task 3: Preview/PDF content parity

**Files:**
- Modify: `frontend/src/features/receipts/ReceiptPreview.tsx`
- Modify: `frontend/src/features/receipts/ReceiptPreview.test.tsx`
- Modify: `frontend/src/features/receipts/ReceiptPreview.a11y.test.tsx`
- Create: `frontend/src/features/receipts/components/InstitutionalReceiptDocument.tsx`
- Create: `frontend/src/features/receipts/components/InstitutionalReceiptDocument.test.tsx`
- Modify: `frontend/src/features/receipt-settings/components/ReceiptSettingsPreview.tsx`
- Modify: `frontend/src/printing/styles/receipt-print.css`
- Modify: `frontend/src/printing/receipt-print-css.test.ts`

**Interfaces:**
- Both preview components consume `InstitutionalReceiptSnapshot`; no local totals or alternate receipt DTO.
- Print CSS uses `[data-paper-profile]` selectors with exact page sizes.

- [ ] **Step 1: Add failing parity test**

```tsx
it('renders every authoritative snapshot section', () => {
  render(<ReceiptPreview snapshot={completeSnapshot} />);
  for (const text of [
    'Hospital General San Isidro', 'Tocoa, Colón, Honduras', completeSnapshot.institution.rtn,
    completeSnapshot.document.number, completeSnapshot.patient.name, completeSnapshot.cashier.name,
    completeSnapshot.cash_session.label, 'Subtotal', 'Exentos', 'ISV', 'Total',
    completeSnapshot.totals.amount_words, completeSnapshot.payment.method_label,
    completeSnapshot.copy.label, 'Firma', 'Sello',
  ]) expect(screen.getByText(text, { exact: false })).toBeVisible();
});

it('does not expose internal machine codes', () => {
  render(<ReceiptPreview snapshot={completeSnapshot} />);
  expect(screen.queryByText(/qr|código de barras|internal_code|scan_code/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify missing sections**

Run: `cd frontend; npm.cmd exec vitest run ReceiptPreview ReceiptSettingsPreview receipt-print-css`

Expected: FAIL until all sections and paper selectors match.

- [ ] **Step 3: Render one shared presentation document**

Create `InstitutionalReceiptDocument` with this contract and use it from both preview routes:

```tsx
type InstitutionalReceiptDocumentProps = {
  snapshot: InstitutionalReceiptSnapshot;
  paperProfile: 'letter_landscape' | 'half_letter_landscape' | 'a5_landscape' | 'thermal_80mm' | 'thermal_58mm';
};

export function InstitutionalReceiptDocument({ snapshot, paperProfile }: InstitutionalReceiptDocumentProps) {
  return (
    <article className="institutional-receipt" data-paper-profile={paperProfile}>
      <ReceiptInstitution institution={snapshot.institution} />
      <ReceiptDocumentMeta document={snapshot.document} copy={snapshot.copy} />
      <ReceiptOperationalMeta patient={snapshot.patient} cashier={snapshot.cashier} cashSession={snapshot.cash_session} />
      <ReceiptItems items={snapshot.items} />
      <ReceiptTotals totals={snapshot.totals} />
      <ReceiptPayment payment={snapshot.payment} fiscal={snapshot.fiscal} />
      <ReceiptSignatures signature={snapshot.signature} />
    </article>
  );
}
```

The named section components live in the same focused file and are presentation-pure. Do not create a compatibility wrapper. The snapshot supplies all strings and amounts.

- [ ] **Step 4: Define exact browser print profiles**

```css
@page receipt-letter { size: Letter landscape; margin: 10mm; }
@page receipt-half-letter { size: 8.5in 5.5in; margin: 8mm; }
@page receipt-a5 { size: A5 landscape; margin: 7mm; }
@page receipt-80 { size: 80mm auto; margin: 4mm; }
@page receipt-58 { size: 58mm auto; margin: 3mm; }
[data-paper-profile="letter_landscape"] { page: receipt-letter; }
[data-paper-profile="half_letter_landscape"] { page: receipt-half-letter; }
[data-paper-profile="a5_landscape"] { page: receipt-a5; }
[data-paper-profile="thermal_80mm"] { page: receipt-80; }
[data-paper-profile="thermal_58mm"] { page: receipt-58; }
.receipt-totals, .receipt-signatures { break-inside: avoid; page-break-inside: avoid; }
```

- [ ] **Step 5: Run tests/axe and commit**

Run: `cd frontend; npm.cmd exec vitest run ReceiptPreview ReceiptSettingsPreview receipt-print-css`

Expected: PASS with no axe violations.

```powershell
git add frontend/src/features/receipts frontend/src/features/receipt-settings/components/ReceiptSettingsPreview.tsx frontend/src/printing
git commit -m "fix(receipts): unify preview and print content"
```

### Task 4: Browser PDF verification

**Files:**
- Modify: `frontend/e2e/print-profiles.spec.ts`
- Modify: `frontend/playwright.release.config.ts`
- Create: `qa/operational-ux/pdf-review.md`

**Interfaces:**
- Produces PDF and PNG per paper profile under test output and reviewed copies under `qa/operational-ux/documents/`.

- [ ] **Step 1: Add browser PDF tests**

Extend the existing `Print profiles - browser PDF certification` loop. Change `installPrintableReceiptFixture` to render four `<tr>` item rows from a fixed array and assert the canonical institution, patient, cashier, cashbox, tax, total, amount words, payment method, copy, signature, and seal. Keep its existing inline PDF validation:

```ts
const services = [
  ['Abdomen embarazo', '1', 'L 45.00', 'L 6.75', 'L 51.75'],
  ['Ácido úrico', '1', 'L 15.00', 'L 2.25', 'L 17.25'],
  ['Glucosa', '1', 'L 15.00', 'L 2.25', 'L 17.25'],
  ['Eritropoyetina', '1', 'L 25.00', 'L 3.75', 'L 28.75'],
];
const itemRows = services.map(([name, quantity, price, tax, total]) =>
  `<tr><td>${name}</td><td>${quantity}</td><td>${price}</td><td>${tax}</td><td>${total}</td></tr>`,
).join('');

const pdf = await readFile(pdfPath);
const pageCount = pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)\b/g)?.length ?? 0;
expect(pageCount).toBe(1);
expect(inspection.content).toContain('Hospital General San Isidro');
expect(inspection.content).toContain('Tocoa, Colón, Honduras');
expect(inspection.content).toContain('Paciente Validación');
expect(inspection.content).toContain('Administradora Hospital');
expect(inspection.content).toContain('Caja #7');
expect(inspection.content).toContain('Efectivo');
```

For `letter`, `half-letter`, and `a5`, keep `preferCSSPageSize: true`; for 80 mm and 58 mm, keep the existing explicit width options and verify the fixture root has `data-template="thermal"`.
```

- [ ] **Step 2: Run and verify browser-rendered output**

Run: `cd frontend; npm.cmd exec playwright test e2e/print-profiles.spec.ts --project=chromium`

Expected: PASS with one-page PDFs for primary profiles and separate 80/58 artifacts.

- [ ] **Step 3: Inspect all PDFs visually**

Render each page to PNG using the bundled PDF tooling. Record font legibility, clipping, row breaks, totals, fiscal data, copy label, signature, and identity area in `qa/operational-ux/pdf-review.md`. Automation does not approve appearance.

- [ ] **Step 4: Commit**

```powershell
git add frontend/e2e/print-profiles.spec.ts frontend/playwright.release.config.ts qa/operational-ux/pdf-review.md qa/operational-ux/documents
git commit -m "test(printing): verify institutional PDFs in browser"
```

### Task 5: Canonical twelve before/after comparison

**Files:**
- Modify: `frontend/e2e/operational-ux-baseline.spec.ts`
- Create: `qa/operational-ux/final-comparison.md`
- Create: `qa/operational-ux/completion-matrix.md`

**Interfaces:**
- Canonical states: login, Dashboard, billing empty, billing with account, cash payment, Carta receipt, history, cash open, cash close, catalog, hospital settings, receipt settings.

- [ ] **Step 1: Regenerate final screenshots without overwriting baseline**

Run: `cd frontend; $env:UX_AUDIT_OUTPUT='..\qa\operational-ux\after'; npm.cmd exec playwright test e2e/operational-ux-baseline.spec.ts`

Expected: all invariant assertions pass and `before/` hashes remain unchanged.

- [ ] **Step 2: Build the comparison report**

For each state, embed before and after paths and complete this fixed table:

```md
| Criterio | Antes | Después | Evidencia | Veredicto |
|---|---:|---:|---|---|
| Overflow horizontal | px | px | audit JSON | PASS/FAIL |
| Scrolls verticales internos | count | count | audit JSON | PASS/FAIL |
| Acción primaria visible | sí/no | sí/no | screenshot + geometry | PASS/FAIL |
| Controles cubiertos | count | count | hit-test | PASS/FAIL |
| Texto inglés | count | count | DOM scan | PASS/FAIL |
| Paginadores | count | count | DOM scan | PASS/FAIL |
| Jerarquía y densidad | defectos | resultado | revisión visual | PASS/FAIL |
```

- [ ] **Step 3: Create requirement-to-evidence matrix**

Copy every requirement from the approved design spec into `completion-matrix.md`. Each row must name an exact test, screenshot, PDF, trace, query output, or manual review record. A row with indirect or missing evidence is `FAIL`, never `N/A`, unless the original requirement explicitly permits it.

- [ ] **Step 4: Commit the evidence**

```powershell
git add qa/operational-ux frontend/e2e/operational-ux-baseline.spec.ts
git commit -m "docs(qa): compare operational UX before and after"
```

### Task 6: Full quality and release gate

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/frontend-final-certification.md`
- Modify: `qa/operational-ux/completion-matrix.md`

- [ ] **Step 1: Run backend gates from a clean seeded database**

```powershell
docker compose up -d
docker compose exec backend php artisan migrate:fresh --seed
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse
```

Expected: every command exits 0. Record counts and durations.

- [ ] **Step 2: Run frontend gates**

```powershell
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run test
docker compose exec frontend npm run test:storybook
docker compose exec frontend npm run build
docker compose exec frontend npm run check:ui-legacy:final
docker compose exec frontend npm run e2e
```

Expected: every command exits 0; zero legacy violations, zero English invariant failures, and all required screenshots/PDFs produced.

- [ ] **Step 3: Run physical/browser checks**

Run the real browser against seeded Laravel/MySQL, inspect every final screenshot and PDF, test 125 %/200 % zoom, keyboard billing/cash/history, and reduced motion. If a second LAN client or physical printer is available, record it using the repository proof templates; do not claim unavailable physical evidence.

- [ ] **Step 4: Audit completion matrix**

Review every row against its named artifact. Any missing, weak, contradictory, stale, or narrower evidence keeps the release open. Do not summarize green tests as proof for unrelated visual requirements.

- [ ] **Step 5: Update release documentation**

Record exact HEAD, commands, results, remaining physical-environment evidence, and the final visual comparison. Do not use `PRODUCTION_READY` unless all separately defined production-readiness proofs also exist.

- [ ] **Step 6: Commit release evidence**

```powershell
git add CHANGELOG.md docs/frontend-final-certification.md qa/operational-ux
git commit -m "docs(release): certify operational UX evidence"
```

- [ ] **Step 7: Verify clean closure**

Run:

```powershell
git status --short
git log --oneline -12
```

Expected: clean worktree and coherent Conventional Commits for baseline, core, grids, administration, documents, and closure. Do not merge until every completion-matrix row passes and the side-by-side review is clearly superior.
