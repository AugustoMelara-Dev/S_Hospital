# Ant Design UI Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar toda interacción de aplicación sobre Ant Design 6, aislar los artefactos del E2E ordinario y conservar los contratos hospitalarios, responsive y de accesibilidad.

**Architecture:** `DesignSystemProvider` y `createInstitutionalTheme` continúan como frontera única de la biblioteca. Un guard estático impide controles manuales nuevos; las migraciones se ejecutan por zona y el HTML nativo queda limitado a documentos imprimibles y tablas alternativas accesibles enumeradas.

**Tech Stack:** React 19, TypeScript 5.9, Ant Design 6.5, Tailwind 4, AG Grid 36, ECharts 6, Vitest 4, Playwright 1.61.

## Global Constraints

- No agregar dependencias ni modificar contratos API o reglas de negocio.
- No tocar ni incluir `frontend/package-lock.json` ni capturas QA preexistentes.
- Ant Design 6 es la única biblioteca de widgets de aplicación.
- Tailwind se limita a composición, responsive y tokens institucionales.
- HTML nativo interactivo solo se permite en tests; tablas productivas nativas solo en documentos imprimibles o alternativas accesibles enumeradas.
- Bundle inicial máximo: 488.3 KiB gzip. Bundle total máximo: 1074.2 KiB gzip.
- Cada tarea termina con pruebas focalizadas y un commit Conventional Commit.

---

### Task 1: Aislar artefactos del E2E ordinario

**Files:**
- Create: `frontend/e2e/fixtures/operational-evidence-path.ts`
- Create: `frontend/e2e/fixtures/operational-evidence-path.test.ts`
- Modify: `frontend/e2e/new-invoice-flow.spec.ts`
- Modify: `frontend/e2e/invoice-history-flow.spec.ts`
- Modify: `frontend/e2e/catalog-flow.spec.ts`

**Interfaces:**
- Consumes: `TestInfo.outputPath(name)` y `process.env.E2E_UPDATE_OPERATIONAL_UX_EVIDENCE`.
- Produces: `operationalEvidencePath(testInfo, fileName, subdirectory?): string`.

- [ ] **Step 1: Escribir tests RED del resolver**

```ts
expect(operationalEvidencePath(fakeTestInfo, 'catalog.png')).toBe('test-output/catalog.png');
process.env.E2E_UPDATE_OPERATIONAL_UX_EVIDENCE = '1';
expect(operationalEvidencePath(fakeTestInfo, 'billing.png', 'core'))
  .toBe(resolve('../qa/operational-ux/after/core/billing.png'));
```

- [ ] **Step 2: Ejecutar RED**

Run: `npm.cmd run test -- operational-evidence-path`
Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar el resolver estricto**

```ts
export function operationalEvidencePath(testInfo: Pick<TestInfo, 'outputPath'>, fileName: string, subdirectory?: string) {
  if (process.env.E2E_UPDATE_OPERATIONAL_UX_EVIDENCE !== '1') return testInfo.outputPath(fileName);
  const directory = resolve('../qa/operational-ux/after', subdirectory ?? '');
  mkdirSync(directory, { recursive: true });
  return resolve(directory, fileName);
}
```

- [ ] **Step 4: Sustituir las trece rutas directas en los tres specs**

Cada test recibirá `testInfo` y usará `operationalEvidencePath`; los nombres actuales se conservan.

- [ ] **Step 5: Verificar aislamiento**

Run: `npm.cmd run test -- operational-evidence-path`
Expected: PASS.

Run: `node node_modules/@playwright/test/cli.js test e2e/new-invoice-flow.spec.ts --project=chromium --grep "keeps billing operable at 1366x768"`
Expected: 1 passed y ninguna modificación nueva bajo `qa/`.

- [ ] **Step 6: Commit**

```powershell
git add frontend/e2e/fixtures/operational-evidence-path.ts frontend/e2e/fixtures/operational-evidence-path.test.ts frontend/e2e/new-invoice-flow.spec.ts frontend/e2e/invoice-history-flow.spec.ts frontend/e2e/catalog-flow.spec.ts
git commit -m "test(e2e): isolate routine visual artifacts"
```

### Task 2: Proteger la convergencia con un guard estático

**Files:**
- Modify: `frontend/scripts/ui-legacy-audit.mjs`
- Modify: `frontend/scripts/ui-legacy-audit.test.mjs`

**Interfaces:**
- Consumes: contenido TSX sin comentarios de bloque.
- Produces: violaciones `native-interactive-control` y `native-application-table`.

- [ ] **Step 1: Añadir casos RED**

```js
assert.equal(scanSource('src/features/a/View.tsx', 'export const V=()=> <button>Guardar</button>').some((v) => v.kind === 'native-interactive-control'), true);
assert.equal(scanSource('src/features/a/View.tsx', 'export const V=()=> <table />').some((v) => v.kind === 'native-application-table'), true);
assert.equal(scanSource('src/features/receipts/ReceiptPreview.tsx', 'export const V=()=> <table />').length, 0);
```

- [ ] **Step 2: Ejecutar RED**

Run: `node --test scripts/ui-legacy-audit.test.mjs`
Expected: FAIL porque las nuevas clases no existen.

- [ ] **Step 3: Implementar reglas y allowlist exacta**

El guard detectará `button`, `input`, `select`, `textarea`, `dialog`, `details` y tablas productivas. Excluirá tests/stories en modo final y permitirá solo ReceiptPreview, ReceiptSettingsPreview, TrendChart y PaymentMethodPanel para tablas semánticas.

- [ ] **Step 4: Verificar unitario y baseline RED del producto**

Run: `node --test scripts/ui-legacy-audit.test.mjs`
Expected: PASS.

Run: `npm.cmd run check:ui-legacy:final`
Expected: FAIL listando únicamente controles pendientes conocidos.

- [ ] **Step 5: Commit**

```powershell
git add frontend/scripts/ui-legacy-audit.mjs frontend/scripts/ui-legacy-audit.test.mjs
git commit -m "test(ui): enforce Ant Design interaction boundary"
```

### Task 3: Migrar shell y estados compartidos

**Files:**
- Modify: `frontend/src/layout/components/UserMenu.tsx`
- Modify: `frontend/src/shell/navigation/CommandPalette.tsx`
- Modify: `frontend/src/shell/navigation/InstitutionalMobileNav.tsx`
- Modify: `frontend/src/design-system/patterns/RouteState.tsx`
- Test: tests colocados junto a esos componentes.

**Interfaces:**
- Consumes: callbacks y props existentes sin cambios.
- Produces: mismos nombres accesibles, rutas y retorno de foco mediante `Button`, `List`, `Menu`, `Drawer` y `Collapse`.

- [ ] **Step 1: Reforzar tests de semántica y foco**

Añadir aserciones para botón de usuario, comandos activos, botón `Más`, `aria-current`, detalle expandible y retorno de foco.

- [ ] **Step 2: Ejecutar RED focalizado**

Run: `npm.cmd run test -- UserMenu CommandPalette InstitutionalMobileNav RouteState`
Expected: al menos una aserción nueva falla antes de migrar.

- [ ] **Step 3: Sustituir controles manuales**

Usar `Button` como trigger de Dropdown/Drawer, `List` para comandos y `Collapse` para detalle. Mantener `Link` de React Router mediante `Button` solo cuando la acción es un control; los enlaces de navegación siguen siendo enlaces semánticos.

- [ ] **Step 4: Verificar zona**

Run: `npm.cmd run test -- UserMenu CommandPalette InstitutionalMobileNav RouteState`
Expected: PASS.

Run: `npm.cmd run typecheck && npm.cmd run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/layout/components/UserMenu.tsx frontend/src/shell/navigation/CommandPalette.tsx frontend/src/shell/navigation/InstitutionalMobileNav.tsx frontend/src/design-system/patterns/RouteState.tsx frontend/src/**/*test.tsx
git commit -m "refactor(ui): converge shell controls on Ant Design"
```

### Task 4: Migrar controles operativos restantes

**Files:**
- Modify: `frontend/src/features/admin/components/PermissionMatrix.tsx`
- Modify: `frontend/src/features/invoices/history/InvoiceHistoryTable.tsx`
- Modify: `frontend/src/features/invoices/components/ServiceSearch.tsx`
- Modify: `frontend/src/features/invoices/components/InvoiceCart.tsx`
- Test: tests focalizados de administración y facturación.

**Interfaces:**
- Consumes: props actuales; no cambia ningún payload.
- Produces: activadores Ant Design, `Table`/`List` responsive y los mismos roles accesibles operativos.

- [ ] **Step 1: Capturar contratos actuales en tests**

Probar selección por teclado, agregar servicio, abrir factura, expandir grupo de permisos, editar cantidad, quitar línea y confirmar factura.

- [ ] **Step 2: Ejecutar RED focalizado**

Run: `npm.cmd run test -- PermissionMatrix InvoiceHistoryTable ServiceSearch InvoiceCart`
Expected: las nuevas aserciones de componentes Ant fallan inicialmente.

- [ ] **Step 3: Migrar activadores**

Reemplazar botones manuales por `Button` con `type="text"` o `type="default"`, conservando `aria-*`, targets de 44 px y referencias `HTMLButtonElement`.

- [ ] **Step 4: Migrar estructuras visuales duplicadas**

Usar `Collapse` para grupos de permisos, `List` para resultados/filas móviles y `Table` para la cuenta cuando preserve el contrato responsive. Si una tabla semántica es imprescindible, documentarla en la allowlist exacta con test.

- [ ] **Step 5: Verificar zona y guard**

Run: `npm.cmd run test -- PermissionMatrix InvoiceHistoryTable ServiceSearch InvoiceCart NewInvoiceView UsersView`
Expected: PASS.

Run: `npm.cmd run check:ui-legacy:final`
Expected: 0 violaciones.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/features/admin/components/PermissionMatrix.tsx frontend/src/features/invoices/history/InvoiceHistoryTable.tsx frontend/src/features/invoices/components/ServiceSearch.tsx frontend/src/features/invoices/components/InvoiceCart.tsx frontend/src/features/**/*.test.tsx
git commit -m "refactor(ui): migrate operational controls to Ant Design"
```

### Task 5: Converger contenedores institucionales

**Files:**
- Modify: `frontend/src/design-system/components/InstitutionalComponents.tsx`
- Modify: `frontend/src/design-system/components/InstitutionalComponents.test.tsx`
- Modify: `frontend/src/design-system/components/InstitutionalComponents.additions.test.tsx`
- Modify: `frontend/src/design-system/antd/theme.ts`

**Interfaces:**
- Consumes: APIs públicas `StatGrid`, `StatCard`, `SectionCard` y `PrintPreviewFrame`.
- Produces: las mismas APIs renderizadas con primitivas Ant Design y tokens institucionales.

- [ ] **Step 1: Escribir tests de implementación pública**

Comprobar que `SectionCard` expone estructura Card, que estadísticas conservan números tabulares y que `PrintPreviewFrame` mantiene región y acciones.

- [ ] **Step 2: Ejecutar RED**

Run: `npm.cmd run test -- InstitutionalComponents`
Expected: las nuevas aserciones de primitives Ant fallan.

- [ ] **Step 3: Migrar internamente sin cambiar props**

Componer `Card`, `Statistic`, `Flex`, `Space` y `Typography`; los wrappers mantienen `data-slot`, semántica de section y clases de layout necesarias.

- [ ] **Step 4: Verificar consumidores**

Run: `npm.cmd run test -- InstitutionalComponents DashboardView ReportsView BackupsView`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/design-system/components/InstitutionalComponents.tsx frontend/src/design-system/components/InstitutionalComponents*.test.tsx frontend/src/design-system/antd/theme.ts
git commit -m "refactor(design-system): compose institutional surfaces with Ant"
```

### Task 6: Certificación completa y documentación

**Files:**
- Modify: `docs/refactor-total-audit.md`
- Modify: `docs/frontend-library-version-decisions.md`

**Interfaces:**
- Consumes: resultados de todos los gates.
- Produces: métricas finales, excepciones y decisiones trazables.

- [ ] **Step 1: Ejecutar quality gates frontend**

Run: `npm.cmd run typecheck; npm.cmd run lint; npm.cmd run check:ui-legacy:final; npm.cmd run test; npm.cmd run build; npm.cmd run budget:bundle`
Expected: todos pasan; 0 violaciones UI; bundle dentro de ambos límites.

- [ ] **Step 2: Ejecutar E2E ordinario**

Run: `npm.cmd run test:e2e:mock`
Expected: todas las pruebas pasan y no aparecen modificaciones nuevas bajo `qa/`.

- [ ] **Step 3: Ejecutar seguridad de dependencias**

Run: `npm.cmd audit --audit-level=low --omit=optional`
Expected: 0 vulnerabilidades.

- [ ] **Step 4: Documentar evidencia**

Registrar conteos antes/después, componentes migrados, resultados, bundle, excepciones semánticas y alternativas descartadas.

- [ ] **Step 5: Verificar diff y commit**

Run: `git diff --check`
Expected: sin errores.

```powershell
git add docs/refactor-total-audit.md docs/frontend-library-version-decisions.md
git commit -m "docs(ui): certify Ant Design convergence"
```
