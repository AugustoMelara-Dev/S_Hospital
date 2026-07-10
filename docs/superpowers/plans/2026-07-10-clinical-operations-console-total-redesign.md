# Clinical Operations Console Total Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar completamente la presentación y experiencia de S_Hospital por Clinical Operations Console sin alterar los contratos transaccionales de facturación, caja, fiscalidad, permisos, auditoría e impresión.

**Architecture:** Un nuevo sistema visual en `frontend/src/design-system` provee tokens, primitives y patterns; un shell en `frontend/src/shell` coordina navegación y estados; las features conservan sus hooks y reglas de dominio mientras sustituyen su composición visual ruta por ruta. La migración usa adaptadores temporales, pero el gate final elimina toda presentación legacy y deja un único canal de feedback.

**Tech Stack:** React 19, TypeScript estricto, Vite 8, Tailwind CSS 4, shadcn/ui sobre Radix, Motion con LazyMotion, TanStack Query/Table/Virtual, React Hook Form, Zod, Sonner, IBM Plex Sans Variable, Vitest, Testing Library, axe-core y Playwright.

## Global Constraints

- Producción opera sin internet; fuentes, iconos, CSS y JavaScript quedan dentro del build local.
- Laravel y MySQL/MariaDB continúan como fuente de verdad para dinero, impuestos, estados, permisos, numeración y auditoría.
- El usuario elige Carta, Media carta o A5; no configura márgenes, medidas, fuente ni escala.
- No borrar facturas, pagos, recibos, cierres ni registros de auditoría.
- No simular egresos, restauración de backups ni otras acciones que carezcan de backend seguro.
- Cada cambio de comportamiento sigue RED → GREEN → REFACTOR y cada ola termina en un commit Conventional Commit.
- Durante desarrollo se ejecutan pruebas dirigidas; `test`, lint, typecheck, build y E2E completos se ejecutan al cierre.
- Especificación fuente: `docs/superpowers/specs/2026-07-10-clinical-operations-console-total-redesign-design.md`.

## File Map

```text
frontend/src/design-system/
  tokens/clinical-tokens.css       variables de color, tipo, espacio y movimiento
  primitives/                      controles básicos accesibles
  patterns/                        estructuras de página, ledger, toolbar y estados
  icons/clinical-icons.ts          catálogo semántico de Lucide
  motion/MotionProvider.tsx        LazyMotion y reduced-motion
frontend/src/shell/
  ClinicalShell.tsx                composición autenticada
  navigation/ClinicalRail.tsx      navegación de escritorio
  navigation/ClinicalMobileNav.tsx navegación móvil
  navigation/CommandPalette.tsx    navegación/acciones por permiso
  status/ContextBar.tsx            caja, red, ruta y usuario sin duplicados
frontend/src/features/**           nuevas composiciones por dominio
frontend/e2e/clinical-*.spec.ts    recorridos visuales, teclado y negocio
docs/                              instalación, permisos, impresión y operación LAN
```

---

### Task 1: Dependencias locales y contrato del nuevo design system

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/src/design-system/tokens/clinical-tokens.css`
- Create: `frontend/src/design-system/tokens/clinical-tokens.test.ts`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Produces: tokens Tailwind `background`, `surface`, `ink`, `clinical`, `attention`, `danger`, `line`; fuente `IBM Plex Sans Variable`; dependencias `motion`, `@tanstack/react-virtual`, `@fontsource-variable/ibm-plex-sans`, `cmdk` y `sonner`.
- Preserves: selectores de impresión `.institutional-receipt`, `@page` y `data-*-print-root`.

- [ ] **Step 1: escribir el test rojo de tokens**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('clinical design tokens', () => {
  const css = readFileSync(new URL('./clinical-tokens.css', import.meta.url), 'utf8');

  it.each(['--color-clinical', '--color-attention', '--color-surface', '--font-sans'])('%s está definido', (token) => {
    expect(css).toContain(token);
  });

  it('incluye un tema oscuro con los mismos roles semánticos', () => {
    expect(css).toMatch(/html\.dark[\s\S]+--color-clinical/);
  });
});
```

- [ ] **Step 2: comprobar RED**

Run: `cd frontend && npm run test -- src/design-system/tokens/clinical-tokens.test.ts`

Expected: FAIL porque `clinical-tokens.css` no existe.

- [ ] **Step 3: instalar dependencias y crear tokens**

Run: `cd frontend && npm install motion @tanstack/react-virtual @fontsource-variable/ibm-plex-sans cmdk sonner`

Crear `clinical-tokens.css` con los valores aprobados en la especificación y mover allí los tokens no relacionados con impresión. Importar `@fontsource-variable/ibm-plex-sans/wght.css` desde `main.tsx` y `clinical-tokens.css` desde `styles.css`.

- [ ] **Step 4: comprobar GREEN y regresión de impresión**

Run: `cd frontend && npm run test -- src/design-system/tokens/clinical-tokens.test.ts src/lib/institutionalReceiptPaper.test.ts`

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/main.tsx frontend/src/styles.css frontend/src/design-system
git commit -m "feat(ui): establish clinical design foundations"
```

---

### Task 2: Primitives, movimiento y feedback únicos

**Files:**
- Create: `frontend/src/design-system/primitives/Button.tsx`
- Create: `frontend/src/design-system/primitives/Field.tsx`
- Create: `frontend/src/design-system/primitives/Surface.tsx`
- Create: `frontend/src/design-system/primitives/StatusMark.tsx`
- Create: `frontend/src/design-system/primitives/Toaster.tsx`
- Create: `frontend/src/design-system/motion/MotionProvider.tsx`
- Create: `frontend/src/design-system/primitives/primitives.test.tsx`
- Modify: `frontend/src/App.tsx`
- Remove at end of task: `frontend/src/components/ui/toaster.tsx`

**Interfaces:**
- Produces: `Button`, `Field`, `Surface`, `StatusMark`, `ClinicalToaster`, `MotionProvider`, `clinicalMotion`.
- Consumes: semantic tokens from Task 1.

- [ ] **Step 1: escribir tests rojos de interacción**

```tsx
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Button } from './Button';
import { Field } from './Field';

it('mantiene un objetivo táctil y estado ocupado accesible', () => {
  render(<Button busy>Guardar</Button>);
  expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('button')).toBeDisabled();
});

it('asocia ayuda y error al control', async () => {
  const { container } = render(<Field label="Paciente" name="patient" error="Ingrese el nombre" />);
  expect(screen.getByLabelText('Paciente')).toHaveAccessibleDescription('Ingrese el nombre');
  expect(await axe(container)).toHaveNoViolations();
});
```

- [ ] **Step 2: comprobar RED**

Run: `cd frontend && npm run test -- src/design-system/primitives/primitives.test.tsx`

Expected: FAIL por imports inexistentes.

- [ ] **Step 3: implementar primitives y proveedor**

`Button` expone variantes `primary | secondary | quiet | danger`, tamaños `sm | md | lg | icon` y `busy`; `Field` genera IDs estables y `aria-describedby`; `Surface` usa `section | article | aside`; `StatusMark` combina texto, icono y tono; `MotionProvider` usa `LazyMotion`, `domAnimation` y `MotionConfig reducedMotion="user"`; `ClinicalToaster` instala Sonner una sola vez.

- [ ] **Step 4: migrar el root y verificar**

Run: `cd frontend && npm run test -- src/design-system/primitives/primitives.test.tsx src/components/ui/button.a11y.test.tsx src/App.test.tsx`

Expected: PASS y ningún warning de `act`, foco o ARIA.

- [ ] **Step 5: commit**

```bash
git add frontend/src/design-system frontend/src/App.tsx frontend/src/components/ui/toaster.tsx
git commit -m "feat(ui): add clinical primitives and feedback"
```

---

### Task 3: Shell clínico, rail, contexto y command palette

**Files:**
- Create: `frontend/src/shell/ClinicalShell.tsx`
- Create: `frontend/src/shell/navigation/ClinicalRail.tsx`
- Create: `frontend/src/shell/navigation/ClinicalMobileNav.tsx`
- Create: `frontend/src/shell/navigation/CommandPalette.tsx`
- Create: `frontend/src/shell/status/ContextBar.tsx`
- Create: `frontend/src/shell/ClinicalShell.test.tsx`
- Modify: `frontend/src/navigation/appNavigation.ts`
- Modify: `frontend/src/App.tsx`
- Remove after cutover: `frontend/src/layout/AppShell.tsx`, `frontend/src/layout/Sidebar.tsx`, `frontend/src/layout/Topbar.tsx`

**Interfaces:**
- Produces: `ClinicalShellProps` compatible con `AppShellProps`; `buildPermittedCommands(user, routes)`.
- Preserves: rutas, permisos, breadcrumbs, guided tour, broadcast sync y preferencia de rail.

- [ ] **Step 1: escribir tests rojos del shell**

```tsx
it('muestra una sola vez caja y hospital, y expone contenido principal', () => {
  renderShell({ cashSession: openCashSession });
  expect(screen.getAllByText(/Caja #12/)).toHaveLength(1);
  expect(screen.getAllByText('Hospital San Isidro')).toHaveLength(1);
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
});

it('la paleta excluye rutas sin permiso', async () => {
  renderShell({ user: cashier });
  await userEvent.keyboard('{Control>}k{/Control}');
  expect(screen.getByRole('dialog', { name: 'Comandos' })).toBeVisible();
  expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: comprobar RED**

Run: `cd frontend && npm run test -- src/shell/ClinicalShell.test.tsx`

Expected: FAIL por shell inexistente.

- [ ] **Step 3: implementar composición responsive**

El shell usa rail de 248/72 px en escritorio, context bar sticky, sheet en tablet y dock móvil con máximo cuatro destinos. `CommandPalette` deriva comandos desde `getVisibleNavigation`, abre con `Ctrl/Cmd+K`, navega con React Router y nunca expone acciones destructivas.

- [ ] **Step 4: reemplazar AppShell y verificar**

Run: `cd frontend && npm run test -- src/shell/ClinicalShell.test.tsx src/navigation/appNavigation.test.ts src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add frontend/src/shell frontend/src/navigation frontend/src/App.tsx frontend/src/layout
git commit -m "feat(shell): replace navigation with clinical console"
```

---

### Task 4: Login, estados globales e Inicio asimétrico

**Files:**
- Modify: `frontend/src/features/auth/LoginView.tsx`
- Modify: `frontend/src/features/auth/PasswordChangeView.tsx`
- Modify: `frontend/src/features/dashboard/DashboardView.tsx`
- Create: `frontend/src/features/dashboard/components/OperationalQueue.tsx`
- Create: `frontend/src/features/dashboard/components/TodayLedger.tsx`
- Create: `frontend/src/design-system/patterns/RouteState.tsx`
- Modify: `frontend/src/components/AppErrorBoundary.tsx`
- Modify: `frontend/src/AppRoutes.tsx`
- Test: existing auth/dashboard/error boundary tests plus new `RouteState.test.tsx`

**Interfaces:**
- Produces: `RouteState` variants `loading | empty | error | denied | offline | not-found`.
- Preserves: login contract, password-change requirement, dashboard queries and permission filtering.

- [ ] **Step 1: escribir tests rojos de jerarquía y estados**

```tsx
it('prioriza la próxima acción del cajero y recompone módulos sin permiso', () => {
  renderDashboard({ canCreateInvoices: true, canViewManagerialReports: false });
  expect(screen.getByRole('heading', { name: 'Continuar operación' })).toBeVisible();
  expect(screen.queryByText('Ingresos del mes')).not.toBeInTheDocument();
});

it('el error global ofrece una acción real de recuperación', () => {
  render(<RouteState kind="error" title="No pudimos cargar caja" action={{ label: 'Reintentar', onClick }} />);
  screen.getByRole('button', { name: 'Reintentar' }).click();
  expect(onClick).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: comprobar RED, implementar y comprobar GREEN**

Run RED/GREEN: `cd frontend && npm run test -- src/features/auth/LoginView.test.tsx src/features/auth/LoginView.a11y.test.tsx src/features/dashboard/DashboardView.test.tsx src/design-system/patterns/RouteState.test.tsx`

Expected final: PASS y axe sin violaciones.

- [ ] **Step 3: commit**

```bash
git add frontend/src/features/auth frontend/src/features/dashboard frontend/src/design-system/patterns frontend/src/components/AppErrorBoundary.tsx frontend/src/AppRoutes.tsx
git commit -m "feat(dashboard): create clinical operational entry points"
```

---

### Task 5: Estación de facturación, cobro y resultado

**Files:**
- Modify: `frontend/src/features/invoices/NewInvoiceView.tsx`
- Replace: `frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx`
- Modify: `frontend/src/features/invoices/components/PatientStep.tsx`
- Modify: `frontend/src/features/invoices/components/ServiceSearch.tsx`
- Modify: `frontend/src/features/invoices/components/InvoiceCart.tsx`
- Modify: `frontend/src/features/invoices/components/PaymentModal.tsx`
- Modify: `frontend/src/features/invoices/components/InvoiceSuccess.tsx`
- Preserve: `frontend/src/features/invoices/state/**`, `invoicePayload.ts`, API hooks.

**Interfaces:**
- Produces: desktop regions `billing-context`, `service-workspace`, `billing-ticket`; mobile steps `patient | services | review | payment`.
- Preserves: backend total authority, idempotency, EPO rule, patient name, payment outcome and receipt actions.

- [ ] **Step 1: escribir tests rojos del nuevo workspace**

```tsx
it('mantiene paciente, servicios y ticket visibles en escritorio', async () => {
  setViewport(1366, 768);
  renderInvoice();
  expect(screen.getByRole('region', { name: 'Paciente' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Servicios' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Cuenta actual' })).toBeVisible();
});

it('presenta el resultado pagado como estado persistente', async () => {
  await completePaidInvoice();
  expect(screen.getByRole('heading', { name: 'Factura pagada' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Imprimir recibo' })).toBeEnabled();
});
```

- [ ] **Step 2: comprobar RED**

Run: `cd frontend && npm run test -- src/features/invoices/components/NewInvoiceViewLayout.test.tsx src/features/invoices/components/InvoiceSuccess.test.tsx`

- [ ] **Step 3: implementar desktop, tablet y móvil sin modificar reducer**

Usar CSS Grid para las tres regiones; ticket sticky solo cuando el viewport lo permite; stepper móvil con botones Atrás/Continuar; `useDeferredValue` para resultados; selección por lector sin modal; un único CTA `Cobrar L x.xx`; diálogo de pago con campos condicionales por método.

- [ ] **Step 4: verificar flujo crítico**

Run: `cd frontend && npm run test -- NewInvoiceView PaymentModal InvoiceCart PatientStep ServiceSearch InvoiceSuccess InstitutionalReceiptFlow --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000`

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add frontend/src/features/invoices
git commit -m "feat(billing): redesign invoice workstation and payment flow"
```

---

### Task 6: Recibo institucional y selector de papel

**Files:**
- Modify: `frontend/src/features/receipts/ReceiptPreview.tsx`
- Modify: `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.tsx`
- Modify: `frontend/src/features/receipt-settings/components/ReceiptSettingsPreview.tsx`
- Modify: `frontend/src/lib/institutionalReceiptPaper.ts`
- Modify: `frontend/src/styles.css` only inside receipt/print selectors.
- Test: existing receipt tests and new visual E2E `frontend/e2e/clinical-receipts.spec.ts`.

**Interfaces:**
- Produces: `PaperChoice` cards for `letter | half-letter | a5`; secondary compatibility group for `80mm | 58mm`.
- Preserves: backend paper enum, receipt content, patient name, no QR/barcode/internal codes.

- [ ] **Step 1: escribir test rojo del contrato sin controles técnicos**

```tsx
it('permite elegir papel sin mostrar controles técnicos', () => {
  renderSettings();
  expect(screen.getByRole('radio', { name: /Carta/ })).toBeVisible();
  expect(screen.getByRole('radio', { name: /Media carta/ })).toBeVisible();
  expect(screen.getByRole('radio', { name: /A5/ })).toBeVisible();
  expect(screen.queryByLabelText(/margen|escala|fuente|tamaño/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: RED → implementar cards y preview fiel → GREEN**

Run: `cd frontend && npm run test -- ReceiptPreview InstitutionalReceiptSettingsView ReceiptSettingsPreview institutionalReceiptPaper`

Expected final: PASS.

- [ ] **Step 3: renderizar PDF/papel visualmente**

Run: `cd frontend && npx playwright test e2e/clinical-receipts.spec.ts --update-snapshots`

Expected: snapshots estables para Carta, Media carta y A5 sin overflow ni corte de paciente/total.

- [ ] **Step 4: commit**

```bash
git add frontend/src/features/receipts frontend/src/features/receipt-settings frontend/src/lib/institutionalReceiptPaper.ts frontend/src/styles.css frontend/e2e/clinical-receipts.spec.ts
git commit -m "feat(printing): replace receipt settings with paper choices"
```

---

### Task 7: Caja y contabilidad como libro operacional

**Files:**
- Modify: `frontend/src/features/cash/CashBoxView.tsx`
- Modify: `frontend/src/features/cash/components/CashSessionHeader.tsx`
- Modify: `frontend/src/features/cash/components/CashMethodSummary.tsx`
- Modify: `frontend/src/features/cash/components/CashMovementsTable.tsx`
- Modify: `frontend/src/features/cash/components/CashClosingPanel.tsx`
- Modify: `frontend/src/modules/accounting/components/AccountingControlPanel.tsx`
- Preserve: reconciliation service and cash API hooks.

**Interfaces:**
- Produces: ledger columns expected, counted, difference, methods; timeline links to invoice/payment; close panel with permission-aware states.
- Preserves: session ownership, DB transactions, close-any permission and audit reason.

- [ ] **Step 1: escribir tests rojos de conciliación visual**

```tsx
it('expone esperado, contado y diferencia como un solo ledger', () => {
  renderCash({ expected: 100_00, counted: 95_00 });
  const ledger = screen.getByRole('region', { name: 'Conciliación de caja' });
  expect(within(ledger).getByText('L 100.00')).toBeVisible();
  expect(within(ledger).getByText('L 95.00')).toBeVisible();
  expect(within(ledger).getByText('-L 5.00')).toHaveAccessibleDescription(/faltante/i);
});

it('no presenta captura de egresos si no existe contrato transaccional', () => {
  renderCash();
  expect(screen.queryByRole('button', { name: /registrar egreso/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: RED → implementar ledger → GREEN**

Run: `cd frontend && npm run test -- CashBoxView CashMethodSummary CashMovementsTable CashClosingPanel AccountingControlPanel reconciliationStatus`

Expected final: PASS.

- [ ] **Step 3: commit**

```bash
git add frontend/src/features/cash frontend/src/modules/accounting
git commit -m "feat(cashbox): present audited operational ledger"
```

---

### Task 8: Historial y catálogo master-detail

**Files:**
- Modify: `frontend/src/features/invoices/InvoiceHistoryView.tsx`
- Modify: `frontend/src/features/invoices/history/InvoiceHistoryFilters.tsx`
- Modify: `frontend/src/features/invoices/history/InvoiceHistoryTable.tsx`
- Create: `frontend/src/features/invoices/history/InvoiceDetailSheet.tsx`
- Modify: `frontend/src/features/catalog/CatalogView.tsx`
- Modify: `frontend/src/features/catalog/components/ServiceCatalogTable.tsx`
- Modify: existing service/category sheets.

**Interfaces:**
- Produces: URL-backed filters, retained scroll/selection, detail sheets, virtual rows above measured threshold.
- Preserves: audited invoice action policy, no delete, service schemas and catalog permissions.

- [ ] **Step 1: escribir tests rojos de continuidad**

```tsx
it('conserva filtros y abre detalle sin abandonar el historial', async () => {
  renderHistory('/invoices?status=pending&q=Ana');
  await userEvent.click(screen.getByRole('row', { name: /Ana López/ }));
  expect(screen.getByRole('dialog', { name: /Factura/ })).toBeVisible();
  expect(window.location.search).toContain('status=pending');
});

it('catálogo conserva búsqueda al editar un servicio', async () => {
  renderCatalog('/catalog?q=eritropoyetina');
  await userEvent.click(screen.getByRole('button', { name: /Editar Eritropoyetina/ }));
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByRole('searchbox')).toHaveValue('eritropoyetina');
});
```

- [ ] **Step 2: RED → implementar master-detail y virtualización → GREEN**

Run: `cd frontend && npm run test -- InvoiceHistoryView InvoiceHistoryTable CatalogView ServiceCatalogTable ServiceSheet CategorySheet invoiceActionPolicy`

Expected final: PASS.

- [ ] **Step 3: commit**

```bash
git add frontend/src/features/invoices frontend/src/features/catalog
git commit -m "feat(records): redesign invoice and catalog workspaces"
```

---

### Task 9: Reportes editoriales y exportación consistente

**Files:**
- Modify: `frontend/src/features/reports/ReportsView.tsx`
- Modify: `frontend/src/features/reports/ReportsExecutive.tsx`
- Modify: `frontend/src/features/reports/ReportsCash.tsx`
- Modify: `frontend/src/features/reports/ReportsAudit.tsx`
- Modify: report components under `frontend/src/features/reports/components/`.
- Preserve: report API hooks, permissions and export payloads.

**Interfaces:**
- Produces: URL-backed `ReportScope`, financial strip, chart + textual equivalent, export scope summary.
- Preserves: executive/cash/audit subroutes and permission fallback.

- [ ] **Step 1: escribir tests rojos del alcance**

```tsx
it('explica y exporta exactamente el periodo filtrado', async () => {
  renderReports('/reports/executive?from=2026-07-01&to=2026-07-10');
  expect(screen.getByText('1–10 julio 2026')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
  expect(exportReport).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-07-01', to: '2026-07-10' }));
});

it('cada gráfica tiene resumen y tabla equivalente', () => {
  renderExecutiveReport();
  expect(screen.getByRole('img', { name: /tendencia de ingresos/i })).toHaveAccessibleDescription();
  expect(screen.getByRole('table', { name: /datos de tendencia/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: RED → implementar lienzos y equivalentes → GREEN**

Run: `cd frontend && npm run test -- ReportsView ReportsExecutive ReportsCash ReportsAudit ExecutiveReportFilters TrendChart PaymentMethodPanel PendingAgingPanel`

Expected final: PASS.

- [ ] **Step 3: commit**

```bash
git add frontend/src/features/reports
git commit -m "feat(reports): create editorial financial reporting"
```

---

### Task 10: Fiscalidad, usuarios, permisos y respaldos

**Files:**
- Modify: settings views under `frontend/src/features/settings/`.
- Modify: `frontend/src/features/admin/UsersView.tsx` and components.
- Modify: `frontend/src/features/backups/BackupsView.tsx` and components.
- Preserve: schemas, API hooks, permission-risk model and backup capability policy.

**Interfaces:**
- Produces: local section navigation, risk confirmation summary, user master-detail, advanced permission matrix, backup timeline.
- Preserves: all backend permission checks; no restore/delete UI without capability.

- [ ] **Step 1: escribir tests rojos de riesgo y capacidades**

```tsx
it('resume el impacto antes de guardar configuración fiscal crítica', async () => {
  renderFiscalSettings({ canEdit: true });
  await changeCaiAndSubmit();
  expect(screen.getByRole('alertdialog', { name: 'Confirmar cambio fiscal' })).toHaveTextContent('afecta nuevas facturas');
});

it('no muestra restaurar ni eliminar respaldo sin capacidades', () => {
  renderBackups({ capabilities: ['create', 'download'] });
  expect(screen.queryByRole('button', { name: /restaurar|eliminar/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: RED → implementar composiciones → GREEN**

Run: `cd frontend && npm run test -- FiscalSettings FiscalNumeration OperationalRules UsersView PermissionMatrix BackupsView BackupHistoryTable`

Expected final: PASS.

- [ ] **Step 3: commit**

```bash
git add frontend/src/features/settings frontend/src/features/admin frontend/src/features/backups
git commit -m "feat(admin): redesign protected hospital administration"
```

---

### Task 11: Ayuda, soporte, estados restantes y eliminación legacy

**Files:**
- Modify: `frontend/src/features/help/HelpView.tsx`
- Modify: `frontend/src/features/support/SupportCenterView.tsx`
- Modify: `frontend/src/features/about/AboutView.tsx`
- Modify: `frontend/src/AppRoutes.tsx`
- Delete: adapters and visual components no longer imported from `frontend/src/components/shared`, `frontend/src/components/ui`, `frontend/src/layout`.
- Create: `frontend/scripts/check-no-legacy-ui.mjs`
- Modify: `frontend/package.json` add `check:ui-legacy`.

**Interfaces:**
- Produces: searchable task help, operational diagnostics, branded 404/denied/offline/error states and mechanical legacy guard.

- [ ] **Step 1: escribir guard rojo**

```js
const forbidden = ['/layout/AppShell', '/layout/Sidebar', '/layout/Topbar', 'react-hot-toast'];
const offenders = sourceFiles.flatMap((file) => forbidden.filter((value) => read(file).includes(value)).map((value) => `${file}: ${value}`));
if (offenders.length > 0) {
  process.stderr.write(`${offenders.join('\n')}\n`);
  process.exit(1);
}
```

- [ ] **Step 2: comprobar RED**

Run: `cd frontend && npm run check:ui-legacy`

Expected: FAIL listando imports legacy todavía presentes.

- [ ] **Step 3: completar migración y eliminar código no importado**

Usar `rg` para demostrar que cada archivo eliminado carece de consumidores. No borrar lógica de dominio, receipt print CSS ni pruebas críticas.

- [ ] **Step 4: comprobar GREEN**

Run: `cd frontend && npm run check:ui-legacy && npm run typecheck && npm run lint`

Expected: tres comandos PASS.

- [ ] **Step 5: commit**

```bash
git add frontend/src frontend/scripts frontend/package.json frontend/package-lock.json
git commit -m "refactor(ui): remove legacy presentation system"
```

---

### Task 12: Matriz visual, accesibilidad y rendimiento

**Files:**
- Create: `frontend/e2e/clinical-visual-matrix.spec.ts`
- Create: `frontend/e2e/clinical-keyboard.spec.ts`
- Modify: `frontend/e2e/all-buttons-smoke.spec.ts`
- Create: `frontend/scripts/report-bundle-budget.mjs`
- Modify: `frontend/package.json` scripts `test:clinical`, `visual:clinical`, `budget:bundle`.

**Interfaces:**
- Produces: screenshots 375/768/1366/1920, axe scan, keyboard flows, overflow check, button smoke and recorded bundle budget.

- [ ] **Step 1: escribir las aserciones E2E**

```ts
for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`sin overflow en ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await loginAs(page, 'admin');
    for (const path of productionRoutes) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(await new AxeBuilder({ page }).analyze()).toHaveNoSeriousViolations();
      await expect(page).toHaveScreenshot(`${slug(path)}-${viewport.width}.png`, { fullPage: true });
    }
  });
}
```

- [ ] **Step 2: ejecutar matriz y corregir cada fallo con test dirigido**

Run: `cd frontend && npm run visual:clinical`

Expected final: PASS en todos los viewports; cambios visuales revisados, no aceptados ciegamente.

- [ ] **Step 3: medir build y chunks**

Run: `cd frontend && npm run build && npm run budget:bundle`

Expected: PASS con reporte de tamaño y ninguna ruta pesada cargada en el chunk inicial sin justificación.

- [ ] **Step 4: commit**

```bash
git add frontend/e2e frontend/scripts frontend/package.json frontend/package-lock.json
git commit -m "test(ui): enforce visual accessibility and bundle budgets"
```

---

### Task 13: Instalación, LAN, impresión, permisos y operaciones

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Create or update: `docs/INSTALLATION.md`
- Create or update: `docs/LAN_PRODUCTION.md`
- Create or update: `docs/PRINTING.md`
- Create or update: `docs/PERMISSIONS.md`
- Create or update: `docs/BACKUP_RESTORE_RUNBOOK.md`
- Modify: `CHANGELOG.md`.

**Interfaces:**
- Produces: instalación limpia reproducible, usuario inicial, comandos, LAN, producción, impresión por papel, roles y recuperación técnica.

- [ ] **Step 1: escribir verificador documental rojo**

Crear `scripts/verify-docs.ps1` que compruebe la existencia de cada documento, la presencia de `docker compose up -d`, `migrate --seed`, frontend/backend tests, build, E2E, IP LAN, usuario inicial y cambio de contraseña.

- [ ] **Step 2: comprobar RED**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-docs.ps1`

Expected: FAIL listando secciones ausentes.

- [ ] **Step 3: completar documentación con comandos reales del repositorio**

Validar cada comando contra `docker-compose.yml`, scripts npm, Artisan, `.env.example`, migraciones y seeders. No documentar flags ni servicios inexistentes.

- [ ] **Step 4: comprobar GREEN y enlaces**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-docs.ps1`

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add README.md .env.example docs scripts/verify-docs.ps1 CHANGELOG.md
git commit -m "docs(operations): document hospital installation and LAN"
```

---

### Task 14: Gate completo y cierre verificable

**Files:**
- Modify only files required by failures reproduced during this task.
- Create: `docs/release/2026-07-10-clinical-console-verification.md`

- [ ] **Step 1: instalación y base de datos desde cero**

```powershell
docker compose up -d
docker compose exec backend php artisan migrate:fresh --seed
```

Expected: servicios healthy, migraciones y seeders exit 0, usuario inicial documentado.

- [ ] **Step 2: backend quality gate**

```powershell
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse
```

Expected: exit 0 en los tres comandos.

- [ ] **Step 3: frontend quality gate**

```powershell
docker compose exec frontend npm run check:ui-legacy
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run test
docker compose exec frontend npm run build
docker compose exec frontend npm run budget:bundle
```

Expected: exit 0, cero tests fallidos y build producido.

- [ ] **Step 4: E2E real y visual**

```powershell
docker compose exec frontend npm run e2e
docker compose exec frontend npm run visual:clinical
docker compose exec frontend npm run smoke:buttons
```

Expected: crear factura, cobrar, imprimir, reimprimir, pendiente, anular, cerrar caja, reportar, administrar y respaldar pasan; cero botones falsos y cero diferencias visuales no revisadas.

- [ ] **Step 5: auditoría final del alcance**

Registrar en `docs/release/2026-07-10-clinical-console-verification.md` comando, fecha, duración, exit code y resumen. Recorrer cada requisito de la especificación y enlazarlo a prueba, screenshot o documento. Si una evidencia falta, el trabajo permanece abierto.

- [ ] **Step 6: commit**

```bash
git add frontend backend docs scripts README.md .env.example
git commit -m "chore(release): verify clinical console redesign"
```

## Execution Order and Review Gates

- Ola A — Tasks 1–4: fundaciones, shell, autenticación e Inicio.
- Ola B — Tasks 5–6: facturación, cobro y recibos.
- Ola C — Tasks 7–9: caja, contabilidad, historial, catálogo y reportes.
- Ola D — Tasks 10–13: administración, limpieza, matriz y documentación.
- Cierre — Task 14: gate completo y evidencia.

No avanzar de ola si sus pruebas dirigidas, typecheck y revisión visual representativa no pasan. No declarar el rediseño terminado antes de completar Task 14.
