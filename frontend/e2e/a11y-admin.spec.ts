import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getUnexpectedApis,
  installCajaMocks,
  installRecibosMocks,
  installResumenMocks,
  resetUnexpectedApis,
} from './fixtures/visual-surfaces';

/**
 * T-FE-13 — Verificación axe de los arreglos de accesibilidad del admin.
 *
 * Alcance: `AdminTabs` (Caja), `AdminTable` y `AdminContextStrip`
 * (Resumen y detalle de Recibos). Reutiliza los mocks sintéticos de
 * `e2e/fixtures/visual-surfaces.ts` (sin backend). No se registra en
 * `scripts/mock-e2e-plan.mjs`.
 *
 * Gate: **0 violaciones `critical` ni `serious`**. Las `moderate`/`minor` y los
 * `incomplete` se reportan sin silenciar en `axe-<superficie>.json`.
 *
 * Evidencia: `hospital-ai/evidencia/T-FE-13/axe-<superficie>.json`.
 */

const EVIDENCE_DIR = resolve(process.env.E2E_EVIDENCE_DIR ?? resolve(process.cwd(), '..', 'hospital-ai', 'evidencia', 'T-FE-13'));
mkdirSync(EVIDENCE_DIR, { recursive: true });

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

type AxeNode = { target: unknown; html: string; failureSummary?: string };
type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  nodes: AxeNode[];
};
type AxeIncomplete = { id: string; impact: string | null; help: string; nodes: AxeNode[] };
type AxeResults = { violations: AxeViolation[]; incomplete: AxeIncomplete[] };

declare global {
  interface Window {
    axe?: { run: (context?: unknown, options?: unknown) => Promise<AxeResults> };
  }
}

async function runAxe(page: Page): Promise<AxeResults> {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    if (!window.axe) throw new Error('axe-core no quedó disponible en window.axe');
    return window.axe.run(document, { resultTypes: ['violations', 'incomplete'] });
  });
}

const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

function blockingViolations(results: AxeResults) {
  return results.violations
    .filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''))
    .map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }));
}

function selectorOf(target: unknown): string {
  if (!Array.isArray(target) || target.length === 0) return '';
  const first = target[0];
  return Array.isArray(first) ? (first as string[]).join(' ') : String(first);
}

function toRecord(name: string, url: string, results: AxeResults) {
  return {
    surface: name,
    url,
    blocking: blockingViolations(results),
    violations: results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      help_url: violation.helpUrl,
      nodes: violation.nodes.length,
      example_selector: selectorOf(violation.nodes[0]?.target),
      example_html: (violation.nodes[0]?.html ?? '').slice(0, 220),
    })),
    incomplete: results.incomplete.map((entry) => ({
      id: entry.id,
      impact: entry.impact,
      help: entry.help,
      nodes: entry.nodes.length,
    })),
    unexpected_api_requests: getUnexpectedApis(),
  };
}

function persist(fileName: string, record: ReturnType<typeof toRecord>): void {
  writeFileSync(
    resolve(EVIDENCE_DIR, fileName),
    `${JSON.stringify({ task_id: 'T-FE-13', generated_at: new Date().toISOString(), ...record }, null, 2)}\n`,
    'utf8',
  );
}

test.use({ viewport: { width: 1366, height: 768 } });

test.describe('T-FE-13 — axe en Caja y Resumen (gate critical + serious)', () => {
  test('Caja — AdminTabs como tablist accesible sin aria-controls colgante', async ({ page }) => {
    resetUnexpectedApis();
    await installCajaMocks(page);
    await page.goto('/caja');
    await expect(page.getByRole('heading', { level: 1, name: /^caja$/i })).toBeVisible();

    const tablist = page.getByRole('tablist', { name: /vista activa de caja/i });
    await expect(tablist).toBeVisible();

    const summary = page.getByRole('tab', { name: 'Resumen' });
    const movements = page.getByRole('tab', { name: 'Movimientos' });
    await expect(summary).toHaveAttribute('aria-selected', 'true');
    await expect(summary).toHaveAttribute('tabindex', '0');
    await expect(movements).toHaveAttribute('aria-selected', 'false');
    await expect(movements).toHaveAttribute('tabindex', '-1');

    // Ningún aria-controls debe quedar apuntando a un id inexistente.
    for (const tab of await tablist.getByRole('tab').all()) {
      await expect(tab).not.toHaveAttribute('aria-controls');
    }

    const summaryResults = await runAxe(page);
    persist('axe-caja-resumen.json', toRecord('Caja (Resumen)', '/caja', summaryResults));
    expect(blockingViolations(summaryResults), 'axe critical/serious en Caja (Resumen)').toEqual([]);

    // Navegación por flechas del tablist propio.
    await summary.focus();
    await page.keyboard.press('ArrowRight');
    await expect(movements).toHaveAttribute('aria-selected', 'true');
    await expect(movements).toBeFocused();

    const movementsResults = await runAxe(page);
    persist('axe-caja-movimientos.json', toRecord('Caja (Movimientos)', '/caja', movementsResults));
    expect(blockingViolations(movementsResults), 'axe critical/serious en Caja (Movimientos)').toEqual([]);
  });

  test('Resumen — navegación principal y scroll de AdminTable', async ({ page }) => {
    resetUnexpectedApis();
    await installResumenMocks(page);
    await page.goto('/resumen');
    await expect(page.getByRole('heading', { level: 1, name: /^resumen$/i })).toBeVisible();

    // El shell actual expone sus destinos en la navegación lateral.
    await expect(
      page.getByRole('navigation', { name: /navegación principal/i }),
    ).toBeVisible();

    // El contenedor desplazable de la tabla acepta foco y tiene nombre.
    const scrollGroup = page.getByRole('group', { name: /^operaciones recientes$/i });
    await scrollGroup.focus();
    await expect(scrollGroup).toBeFocused();

    const results = await runAxe(page);
    persist('axe-resumen.json', toRecord('Resumen', '/resumen', results));
    expect(blockingViolations(results), 'axe critical/serious en Resumen').toEqual([]);
  });

  test('Recibos (detalle) — scroll de AdminTable accesible por teclado', async ({ page }) => {
    resetUnexpectedApis();
    await installRecibosMocks(page);
    await page.goto('/recibos?operacion=501');
    await expect(
      page.getByRole('complementary', { name: /detalle de la operación/i }),
    ).toBeVisible();

    // El contenedor desplazable de las líneas acepta foco (T-QA-06 serious
    // `scrollable-region-focusable` sobre este mismo contenedor).
    const scrollGroup = page.getByRole('group', { name: /^líneas de la operación$/i });
    await scrollGroup.focus();
    await expect(scrollGroup).toBeFocused();

    const results = await runAxe(page);
    persist(
      'axe-recibos-detalle.json',
      toRecord('Recibos (detalle)', '/recibos?operacion=501', results),
    );
    expect(blockingViolations(results), 'axe critical/serious en Recibos (detalle)').toEqual([]);
  });
});
