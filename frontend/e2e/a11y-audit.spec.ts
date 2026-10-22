import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getUnexpectedApis,
  installCajaMocks,
  installCatalogAdminMocks,
  installCobrarMocks,
  installLoginSurface,
  installRecibosMocks,
  installReportesMocks,
  installResumenMocks,
  layoutMetrics,
  prepareMixedCart,
  resetUnexpectedApis,
} from './fixtures/visual-surfaces';

/**
 * T-QA-06 — Accesibilidad automatizada (axe-core) + proxy de reflujo 200 %.
 *
 * Reutiliza el mismo mock sintético que `visual-capture.spec.ts`
 * (`e2e/fixtures/visual-surfaces.ts`); no hay backend ni datos reales.
 *
 * El spec NO se registra en `scripts/mock-e2e-plan.mjs`: no altera los 13 tests
 * del job CI `e2e-mocked`. Se ejecuta a demanda en chromium/firefox/webkit.
 *
 * Reportes: `hospital-ai/evidencia/T-QA-06/logs/axe-report-<project>.json`
 * y `.../reflow-proxy-<project>.json`. Cada prueba persiste su resultado en
 * disco en el momento: Playwright reinicia el worker tras un fallo y una
 * acumulación en memoria perdería las superficies previas.
 */

const LOG_DIR = resolve(process.cwd(), '..', 'hospital-ai', 'evidencia', 'T-QA-06', 'logs');
mkdirSync(LOG_DIR, { recursive: true });

/**
 * `page.addScriptTag({ path })` inyecta el mismo bundle que revisa
 * `axe.run`. Resolvemos la ruta en orden: dependencia de `frontend`, luego
 * `node_modules` relativos al cwd (por si el runner se invoca desde la raíz).
 */
function resolveAxePath(): string {
  const requireFromFrontend = createRequire(resolve(process.cwd(), 'package.json'));
  const candidates = [
    () => requireFromFrontend.resolve('axe-core/axe.min.js'),
    () => resolve(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js'),
    () => resolve(process.cwd(), 'frontend', 'node_modules', 'axe-core', 'axe.min.js'),
  ];

  for (const candidate of candidates) {
    try {
      const path = candidate();
      if (existsSync(path)) return path;
    } catch {
      // Sigue con el siguiente candidato.
    }
  }

  throw new Error('No se encontró axe-core/axe.min.js en node_modules.');
}

const AXE_PATH = resolveAxePath();
const AXE_VERSION = (() => {
  const requireFromFrontend = createRequire(resolve(process.cwd(), 'package.json'));
  try {
    return String(requireFromFrontend('axe-core/package.json').version);
  } catch {
    return 'desconocida';
  }
})();

const BASE_URL = 'http://127.0.0.1:4173 (Vite dev + mocks Playwright; sin backend)';

type AxeNode = { html: string; target: unknown; impact?: string | null; failureSummary?: string };
type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  description: string;
  helpUrl: string;
  tags: string[];
  nodes: AxeNode[];
};
type AxeIncomplete = { id: string; impact: string | null; help: string; nodes: AxeNode[] };
type AxeResults = {
  violations: AxeViolation[];
  incomplete: AxeIncomplete[];
  testEngine?: { version?: string };
};

declare global {
  interface Window {
    axe?: { run: (context?: unknown, options?: unknown) => Promise<AxeResults> };
  }
}

function selectorOf(target: unknown): string {
  if (!Array.isArray(target) || target.length === 0) return '';
  const first = target[0];
  if (Array.isArray(first)) return (first as string[]).join(' ');
  return String(first);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor', 'n/a'];

type SurfaceAudit = {
  name: string;
  url: string;
  violations: Array<{
    id: string;
    impact: string;
    help: string;
    description: string;
    help_url: string;
    tags: string[];
    nodes: number;
    example_selector: string;
    example_html: string;
  }>;
  incomplete: Array<{ id: string; impact: string; help: string; nodes: number }>;
  unexpected_api_requests: string[];
};

type ReflowCheck = {
  surface: string;
  viewport: string;
  scrollWidth: number;
  clientWidth: number;
  overflow_px: number;
  passes: boolean;
  key_controls_visible: string[];
};

function readReport<T extends { surfaces?: unknown[]; checks?: unknown[] }>(
  path: string,
  empty: () => T,
): T {
  if (!existsSync(path)) return empty();
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return empty();
  }
}

// Orden canónico de superficies para el reporte (independiente del orden de
// ejecución y de reinicios de worker tras un fallo).
const AXE_SURFACE_ORDER = [
  'Login',
  'Resumen',
  'Cobrar (carrito mixto)',
  'Recibos (detalle)',
  'Caja',
  'Reportes',
  'Administración/Catálogo',
  'Recibos (diálogo de recibo institucional)',
];
const REFLOW_ORDER = ['Cobrar', 'Resumen'];

function persistAxeResult(project: string, audit: SurfaceAudit): void {
  type File = {
    task_id: string;
    project: string;
    generated_at: string;
    base_url: string;
    axe_core_version: string;
    note: string;
    surfaces: SurfaceAudit[];
  };
  const path = resolve(LOG_DIR, `axe-report-${project}.json`);
  const data = readReport<File>(path, () => ({
    task_id: 'T-QA-06',
    project,
    generated_at: '',
    base_url: BASE_URL,
    axe_core_version: AXE_VERSION,
    note: 'axe.run sobre el documento completo, sin exclusiones amplias. Impactos: critical > serious > moderate > minor.',
    surfaces: [],
  }));
  data.generated_at = new Date().toISOString();
  const index = data.surfaces.findIndex((entry) => entry.name === audit.name);
  if (index >= 0) data.surfaces[index] = audit;
  else data.surfaces.push(audit);
  data.surfaces = data.surfaces
    .filter((entry) => AXE_SURFACE_ORDER.includes(entry.name))
    .sort((a, b) => AXE_SURFACE_ORDER.indexOf(a.name) - AXE_SURFACE_ORDER.indexOf(b.name));
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function persistReflowCheck(project: string, check: ReflowCheck): void {
  type File = {
    task_id: string;
    project: string;
    generated_at: string;
    method: string;
    checks: ReflowCheck[];
  };
  const path = resolve(LOG_DIR, `reflow-proxy-${project}.json`);
  const data = readReport<File>(path, () => ({
    task_id: 'T-QA-06',
    project,
    generated_at: '',
    method:
      'Proxy de reflujo: viewport CSS 683x384 equivalente a 1366x768 con zoom 200 %. NO es zoom real del navegador.',
    checks: [],
  }));
  data.generated_at = new Date().toISOString();
  const index = data.checks.findIndex((entry) => entry.surface === check.surface);
  if (index >= 0) data.checks[index] = check;
  else data.checks.push(check);
  data.checks = data.checks
    .filter((entry) => REFLOW_ORDER.includes(entry.surface))
    .sort((a, b) => REFLOW_ORDER.indexOf(a.surface) - REFLOW_ORDER.indexOf(b.surface));
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function runAxe(page: Page): Promise<AxeResults> {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    if (!window.axe) throw new Error('axe-core no quedó disponible en window.axe');
    // Sin exclusiones amplias: se audita el documento completo renderizado.
    return window.axe.run(document, { resultTypes: ['violations', 'incomplete'] });
  });
}

function toSurfaceAudit(name: string, url: string, results: AxeResults): SurfaceAudit {
  return {
    name,
    url,
    violations: [...results.violations]
      .sort(
        (a, b) =>
          IMPACT_ORDER.indexOf(a.impact ?? 'n/a') - IMPACT_ORDER.indexOf(b.impact ?? 'n/a'),
      )
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? 'n/a',
        help: violation.help,
        description: violation.description,
        help_url: violation.helpUrl,
        tags: violation.tags,
        nodes: violation.nodes.length,
        example_selector: selectorOf(violation.nodes[0]?.target),
        example_html: truncate(violation.nodes[0]?.html ?? '', 220),
      })),
    incomplete: results.incomplete.map((entry) => ({
      id: entry.id,
      impact: entry.impact ?? 'n/a',
      help: entry.help,
      nodes: entry.nodes.length,
    })),
    unexpected_api_requests: getUnexpectedApis(),
  };
}

type Surface = { name: string; url: string; prepare: (page: Page) => Promise<void> };

const SURFACES: Surface[] = [
  {
    name: 'Login',
    url: '/login',
    prepare: async (page) => {
      await installLoginSurface(page);
      await page.goto('/login');
      await expect(page.getByRole('button', { name: /^iniciar sesión$/i })).toBeVisible();
    },
  },
  {
    name: 'Resumen',
    url: '/resumen',
    prepare: async (page) => {
      await installResumenMocks(page);
      await page.goto('/resumen');
      await expect(page.getByRole('heading', { level: 1, name: /^resumen$/i })).toBeVisible();
    },
  },
  {
    name: 'Cobrar (carrito mixto)',
    url: '/cobrar',
    prepare: async (page) => {
      await installCobrarMocks(page);
      await prepareMixedCart(page);
    },
  },
  {
    name: 'Recibos (detalle)',
    url: '/recibos?operacion=501',
    prepare: async (page) => {
      await installRecibosMocks(page);
      await page.goto('/recibos?operacion=501');
      await expect(
        page.getByRole('complementary', { name: /detalle de la operación/i }),
      ).toBeVisible();
    },
  },
  {
    name: 'Caja',
    url: '/caja',
    prepare: async (page) => {
      await installCajaMocks(page);
      await page.goto('/caja');
      await expect(page.getByText('Caja abierta').first()).toBeVisible({ timeout: 10_000 });
      // CajaView es un chunk `lazy`: hay que esperar su h1 real antes de
      // auditar, o el contexto del shell puede satisfacer el texto de espera y
      // axe mediría la pantalla de carga (falso `page-has-heading-one`).
      await expect(page.getByRole('heading', { level: 1, name: /^caja$/i })).toBeVisible();
    },
  },
  {
    name: 'Reportes',
    url: '/reportes',
    prepare: async (page) => {
      await installReportesMocks(page);
      await page.goto('/reportes');
      await expect(page.getByRole('heading', { level: 1, name: /^reportes$/i })).toBeVisible();
    },
  },
  {
    name: 'Administración/Catálogo',
    url: '/administracion/catalogo',
    prepare: async (page) => {
      await installCatalogAdminMocks(page);
      await page.goto('/administracion/catalogo');
      await expect(page.getByRole('heading', { level: 1, name: /^administración$/i })).toBeVisible();
    },
  },
  {
    name: 'Recibos (diálogo de recibo institucional)',
    url: '/recibos',
    prepare: async (page) => {
      await installRecibosMocks(page);
      await page.goto('/recibos');
      await page
        .getByRole('row', { name: /A-0002/i })
        .getByRole('button', { name: /ver recibo/i })
        .click();
      await expect(
        page.getByRole('dialog', { name: /comprobante de factura - A-0002/i }),
      ).toBeVisible();
    },
  },
];

test.use({ viewport: { width: 1366, height: 768 } });

test.describe('A11Y — axe-core sobre superficies activas', () => {
  for (const surface of SURFACES) {
    test(`axe — ${surface.name}`, async ({ page }) => {
      resetUnexpectedApis();
      await surface.prepare(page);
      const results = await runAxe(page);
      persistAxeResult(test.info().project.name, toSurfaceAudit(surface.name, surface.url, results));

      // Gate mínimo y explícito: sólo se falla ante violaciones `critical` de
      // axe (bloqueos inequívocos). `serious`/`moderate`/`minor` se reportan en
      // el JSON/INFORME sin silenciarse ni excluirse.
      const critical = results.violations.filter((violation) => violation.impact === 'critical');
      expect(
        critical.map((violation) => violation.id),
        `axe critical en "${surface.name}"`,
      ).toEqual([]);
    });
  }
});

/**
 * Proxy de reflujo a 683x384: 1366 px con zoom 200 % reduce el viewport CSS a
 * ~683 px. NO es zoom real del navegador (no se aplica `deviceScaleFactor` ni
 * `zoom` CSS), es un proxy del reflujo horizontal. Ver `INFORME.md`.
 */
test.describe('A11Y — proxy 200 % (683x384, reflujo)', () => {
  test.use({ viewport: { width: 683, height: 384 } });

  test('reflujo — Cobrar', async ({ page }) => {
    resetUnexpectedApis();
    await installCobrarMocks(page);
    await prepareMixedCart(page);

    const controls = [
      page.getByLabel(/nombre del paciente/i),
      page.getByLabel(/^categoría$/i),
      page.locator('[aria-label="Líneas de la cuenta"]'),
      page.getByRole('complementary', { name: /total y acción/i }),
    ];
    const visible: string[] = [];
    for (const control of controls) {
      await expect(control).toBeVisible();
      visible.push(await control.evaluate((el) => el.tagName.toLowerCase()));
    }

    const metrics = await layoutMetrics(page);
    persistReflowCheck(test.info().project.name, {
      surface: 'Cobrar',
      viewport: '683x384 (proxy 200% de 1366x768)',
      scrollWidth: metrics.scrollWidth,
      clientWidth: metrics.clientWidth,
      overflow_px: Math.max(0, metrics.scrollWidth - metrics.clientWidth),
      passes: metrics.scrollWidth <= metrics.clientWidth,
      key_controls_visible: visible,
    });
    expect(metrics.scrollWidth, 'Cobrar desborda a 683 px').toBeLessThanOrEqual(metrics.clientWidth);
  });

  test('reflujo — Resumen', async ({ page }) => {
    resetUnexpectedApis();
    await installResumenMocks(page);
    await page.goto('/resumen');
    await expect(page.getByRole('heading', { level: 1, name: /^resumen$/i })).toBeVisible();

    const controls = [
      page.getByRole('heading', { level: 1, name: /^resumen$/i }),
      page.getByRole('heading', { name: /operaciones recientes/i }),
    ];
    const visible: string[] = [];
    for (const control of controls) {
      await expect(control).toBeVisible();
      visible.push(await control.evaluate((el) => el.tagName.toLowerCase()));
    }

    const metrics = await layoutMetrics(page);
    persistReflowCheck(test.info().project.name, {
      surface: 'Resumen',
      viewport: '683x384 (proxy 200% de 1366x768)',
      scrollWidth: metrics.scrollWidth,
      clientWidth: metrics.clientWidth,
      overflow_px: Math.max(0, metrics.scrollWidth - metrics.clientWidth),
      passes: metrics.scrollWidth <= metrics.clientWidth,
      key_controls_visible: visible,
    });
    expect(metrics.scrollWidth, 'Resumen desborda a 683 px').toBeLessThanOrEqual(metrics.clientWidth);
  });
});
