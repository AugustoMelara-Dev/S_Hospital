import { expect, test } from '@playwright/test';

import { assertNoDocumentOverflow, observeOperationalPage } from './fixtures/operational-ux-audit';

test('records geometry, scroll and browser failures', async ({ page }, testInfo) => {
  const auditObserver = observeOperationalPage(page);

  await page.setContent('<main data-audit-panel="main"><button>Continuar</button></main>');

  const audit = await auditObserver.capture({
    routeName: 'fixture',
    primaryAction: 'Continuar',
    testInfo,
  });

  expect(audit.viewport.width).toBeGreaterThan(0);
  assertNoDocumentOverflow(audit);
  expect(audit.panels.main.width).toBeGreaterThan(0);
  expect(audit.primaryAction?.visible).toBe(true);
  expect(audit.primaryAction?.inViewport).toBe(true);
  expect(audit.primaryAction?.covered).toBe(false);
  expect(audit.consoleErrors).toEqual([]);
  expect(audit.pageErrors).toEqual([]);
  expect(audit.failedRequests).toEqual([]);
});

test('records console, page and request failures raised after observation starts', async ({ page }, testInfo) => {
  const auditObserver = observeOperationalPage(page);
  await page.route('https://hospital.invalid/failure', (route) => route.abort('failed'));

  await page.setContent(`
    <main data-audit-panel="main"><button>Continuar</button></main>
    <script>
      console.error('Fallo de consola controlado');
      setTimeout(() => { throw new Error('Fallo de página controlado'); }, 0);
      fetch('https://hospital.invalid/failure').catch(() => undefined);
    </script>
  `);

  const audit = await auditObserver.capture({
    routeName: 'fixture-failures',
    primaryAction: 'Continuar',
    testInfo,
  });

  expect(audit.consoleErrors).toContain('Fallo de consola controlado');
  expect(audit.pageErrors).toContain('Fallo de página controlado');
  expect(audit.failedRequests).toEqual([
    'GET https://hospital.invalid/failure',
  ]);
});
