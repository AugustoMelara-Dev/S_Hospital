import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getUnexpectedApis,
  installRecibosMocks,
  installResumenMocks,
  resetUnexpectedApis,
} from './fixtures/visual-surfaces';

/**
 * T-FE-14 — Verificación real de la command palette y del sorting de tablas.
 *
 * Reutiliza los mocks sintéticos de `e2e/fixtures/visual-surfaces.ts` (sin
 * backend). No se registra en `scripts/mock-e2e-plan.mjs`.
 *
 * Gate axe: **0 violaciones `critical` ni `serious`** con la palette abierta.
 * Evidencia: `hospital-ai/evidencia/T-FE-14/axe-command-palette.json`.
 */

const EVIDENCE_DIR = resolve(process.cwd(), '..', 'hospital-ai', 'evidencia', 'T-FE-14');
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
      example_selector: selectorOf(entry.nodes[0]?.target),
      example_html: (entry.nodes[0]?.html ?? '').slice(0, 220),
    })),
    unexpected_api_requests: getUnexpectedApis(),
  };
}

test.use({ viewport: { width: 1366, height: 768 } });

test.describe('T-FE-14 — command palette y sorting (axe real, sin backend)', () => {
  test('shell con la palette abierta: axe sin critical/serious y foco de teclado', async ({ page }) => {
    resetUnexpectedApis();
    await installResumenMocks(page);
    await page.goto('/resumen');
    await expect(page.getByRole('heading', { level: 1, name: /^resumen$/i })).toBeVisible();

    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /paleta de comandos/i });
    await expect(dialog).toBeVisible();

    const search = page.getByRole('combobox', { name: /buscar acciones y operaciones/i });
    await expect(search).toBeFocused();
    await expect(dialog.getByRole('option', { name: /^ir a resumen/i })).toBeVisible();

    // Flechas + activedescendant: el foco permanece en el input.
    await page.keyboard.press('ArrowDown');
    await expect(dialog.getByRole('option', { name: /^ir a cobrar/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(search).toBeFocused();

    const results = await runAxe(page);
    writeFileSync(
      resolve(EVIDENCE_DIR, 'axe-command-palette.json'),
      `${JSON.stringify({ task_id: 'T-FE-14', generated_at: new Date().toISOString(), ...toRecord('Shell con command palette abierta', '/resumen', results) }, null, 2)}\n`,
      'utf8',
    );
    expect(blockingViolations(results), 'axe critical/serious con la palette abierta').toEqual([]);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('el disparador de la barra abre la palette y recupera el foco al cerrar', async ({ page }) => {
    resetUnexpectedApis();
    await installResumenMocks(page);
    await page.goto('/resumen');

    const trigger = page.getByRole('button', { name: 'Abrir paleta de comandos' });
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: /paleta de comandos/i });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('combobox', { name: /buscar acciones y operaciones/i })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Recibos: ordenación accesible por Total con aria-sort y filas reordenadas', async ({ page }) => {
    resetUnexpectedApis();
    await installRecibosMocks(page);
    await page.goto('/recibos');

    const table = page.getByRole('table', { name: /operaciones filtradas/i });
    await expect(table).toBeVisible();

    const totalHeader = page.getByRole('columnheader', { name: /total/i });
    await expect(totalHeader).toHaveAttribute('aria-sort', 'none');

    await totalHeader.getByRole('button', { name: /total/i }).click();
    await expect(totalHeader).toHaveAttribute('aria-sort', 'ascending');

    const rows = table.locator('tbody tr');
    await expect(rows.first()).toContainText('A-0002');
    await expect(rows.nth(1)).toContainText('A-0001');

    await totalHeader.getByRole('button', { name: /total/i }).click();
    await expect(totalHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(rows.first()).toContainText('A-0001');

    const results = await runAxe(page);
    writeFileSync(
      resolve(EVIDENCE_DIR, 'axe-recibos-sorting.json'),
      `${JSON.stringify({ task_id: 'T-FE-14', generated_at: new Date().toISOString(), ...toRecord('Recibos con tabla ordenada por Total', '/recibos', results) }, null, 2)}\n`,
      'utf8',
    );
    expect(blockingViolations(results), 'axe critical/serious en Recibos ordenado').toEqual([]);
  });
});
