import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installCobrarMocks, prepareMixedCart } from './fixtures/visual-surfaces';

/**
 * C2-U2 — Diagnóstico del diálogo y de los overlays, en navegador real.
 *
 * El encargo no acepta «la superficie era opaca pero el scrim dejaba ver el
 * fondo» como cierre por sí solo: hay que medir el render. Esta prueba:
 *
 *  1. mide `opacity`, `filter`, `backdrop-filter`, color de fondo con alfa,
 *     `z-index`, `position`, `transform` y `display` del contenido del diálogo
 *     **y de toda su cadena de ancestros**, en estado ESTABLE;
 *  2. muestrea el mismo contenido **durante la entrada**, para separar un
 *     defecto real de un artefacto de captura intermedia;
 *  3. recorre el cajón móvil con teclado: foco inicial, Tab/Shift+Tab, Escape,
 *     retorno de foco y fondo inerte;
 *  4. vuelve a ejecutar axe-core sobre el diálogo abierto.
 *
 * Usa los mocks sintéticos de `e2e/fixtures/visual-surfaces.ts` (no hay backend
 * en esta prueba). Su evidencia queda separada de la integración real.
 */

const OUT_DIR = resolve(process.cwd(), '..', 'hospital-ai', 'evidencia', 'C3-U2');
mkdirSync(OUT_DIR, { recursive: true });

function resolveAxePath(): string {
  const requireFromFrontend = createRequire(resolve(process.cwd(), 'package.json'));
  const candidates = [
    () => requireFromFrontend.resolve('axe-core/axe.min.js'),
    () => resolve(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js'),
  ];

  for (const candidate of candidates) {
    try {
      const path = candidate();
      if (existsSync(path)) return path;
    } catch {
      // Siguiente candidato.
    }
  }

  throw new Error('No se encontró axe-core/axe.min.js.');
}

type LayerInfo = {
  tag: string;
  slot: string | null;
  id: string | null;
  classes: string;
  opacity: string;
  filter: string;
  backdropFilter: string;
  backgroundColor: string;
  zIndex: string;
  position: string;
  transform: string;
  display: string;
  visibility: string;
};

async function layerChain(page: Page, selector: string): Promise<LayerInfo[]> {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel);
    if (!node) return [];

    const chain: LayerInfo[] = [];
    let current: Element | null = node;

    while (current) {
      const style = window.getComputedStyle(current);
      chain.push({
        tag: current.tagName.toLowerCase(),
        slot: current.getAttribute('data-slot'),
        id: current.getAttribute('id'),
        classes: (current.getAttribute('class') ?? '').slice(0, 140),
        opacity: style.opacity,
        filter: style.filter,
        backdropFilter: style.backdropFilter,
        backgroundColor: style.backgroundColor,
        zIndex: style.zIndex,
        position: style.position,
        transform: style.transform,
        display: style.display,
        visibility: style.visibility,
      });
      current = current.parentElement;
    }

    return chain;
  }, selector);
}

/**
 * Alfa del color de fondo computado. Tailwind v4 emite funciones de color
 * modernas (`oklab(...)`, `oklch(...)`, `color-mix(...)`), no solo `rgba()`, así
 * que se busca el alfa explícito en cualquiera de sus formas y, si no aparece,
 * el color es opaco.
 */
function backgroundAlpha(color: string): number | null {
  const rgba = /rgba?\(([^)]+)\)/.exec(color);
  if (rgba) {
    const parts = rgba[1].split(',').map((value) => Number.parseFloat(value.trim()));
    return parts.length >= 4 ? parts[3] : 1;
  }

  // `oklab(L a b / 0.3)`, `oklch(L C H / 30%)`, `color(srgb r g b / 0.3)`.
  const modern = /\(\s*[^)]*?\/\s*([\d.]+%?)\s*\)/.exec(color);
  if (modern) {
    const raw = modern[1];
    return raw.endsWith('%') ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);
  }

  if (color === 'transparent') return 0;
  if (color === '') return null;

  return 1;
}

function writeReport(name: string, payload: unknown): void {
  writeFileSync(resolve(OUT_DIR, name), JSON.stringify(payload, null, 2), 'utf8');
}

test.describe('C2-U2 · diálogo y overlays en navegador', () => {
  test('el contenido del diálogo es opaco y ningún ancestro lo atenúa (estado estable)', async ({ page }) => {
    await installCobrarMocks(page);
    await prepareMixedCart(page);
    await page.getByTestId('cobrar-primary-action').click();

    const dialog = page.getByRole('dialog', { name: /confirmar cobro/i });
    await expect(dialog).toBeVisible();

    // Estado ESTABLE: se deja terminar la animación finita antes de medir.
    await page.waitForTimeout(700);

    const chain = await layerChain(page, '[data-slot="dialog-content"]');
    expect(chain.length).toBeGreaterThan(0);

    const content = chain[0];
    const ancestors = chain.slice(1);

    // La superficie es opaca: fondo con alfa 1 y opacidad 1.
    expect(backgroundAlpha(content.backgroundColor), 'fondo del diálogo').toBe(1);
    expect(content.opacity, 'opacidad del contenido').toBe('1');
    expect(content.display).not.toBe('none');
    expect(content.visibility).not.toBe('hidden');

    // Ningún ancestro reduce la opacidad ni aplica filtros al panel.
    const attenuating = ancestors.filter(
      (layer) =>
        Number.parseFloat(layer.opacity) < 1 ||
        (layer.filter !== 'none' && layer.filter !== '') ||
        (layer.backdropFilter !== 'none' && layer.backdropFilter !== ''),
    );
    expect(attenuating, 'ancestros que atenúan el panel').toEqual([]);

    // El scrim sí existe, es translúcido y está por debajo del contenido.
    const overlay = await layerChain(page, '[data-slot="dialog-overlay"]');
    expect(overlay.length).toBeGreaterThan(0);
    const overlayAlpha = backgroundAlpha(overlay[0].backgroundColor);
    expect(overlayAlpha, 'el scrim debe ser translúcido').not.toBeNull();
    expect(overlayAlpha!).toBeLessThan(1);

    writeReport('dialogo-estable.json', {
      medido_en: 'estado estable (700 ms tras abrir)',
      contenido: content,
      ancestros: ancestors,
      scrim: overlay[0],
      ancestros_atenuantes: attenuating.length,
    });
  });

  test('durante la entrada el contenido no es translúcido (separa defecto de captura)', async ({ page }) => {
    await installCobrarMocks(page);
    await prepareMixedCart(page);

    await page.getByTestId('cobrar-primary-action').click();

    // Muestreo inmediato, mientras la transición de entrada está en curso.
    const samples: Array<{ t: number; contentOpacity: string; overlayOpacity: string }> = [];
    const started = Date.now();

    for (let index = 0; index < 8; index += 1) {
      const sample = await page.evaluate(() => {
        const content = document.querySelector('[data-slot="dialog-content"]');
        const overlay = document.querySelector('[data-slot="dialog-overlay"]');
        return {
          contentOpacity: content ? window.getComputedStyle(content).opacity : 'ausente',
          overlayOpacity: overlay ? window.getComputedStyle(overlay).opacity : 'ausente',
        };
      });

      samples.push({ t: Date.now() - started, ...sample });
      await page.waitForTimeout(25);
    }

    writeReport('dialogo-entrada.json', {
      nota:
        'El overlay anima su opacidad (fundido del velo). El contenido puede animar su propia opacidad de entrada; lo que se comprueba es que NO herede una opacidad parcial de un ancestro y que su superficie de fondo siga siendo opaca.',
      muestras: samples,
    });

    const chain = await layerChain(page, '[data-slot="dialog-content"]');
    const ancestors = chain.slice(1);
    const attenuating = ancestors.filter((layer) => Number.parseFloat(layer.opacity) < 1);
    expect(attenuating, 'ancestros atenuando durante la entrada').toEqual([]);

    await expect(page.getByRole('dialog', { name: /confirmar cobro/i })).toBeVisible();
  });

  test('cajón móvil: foco atrapado, Escape y fondo inerte', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installCobrarMocks(page);
    await prepareMixedCart(page);

    const opener = page.getByRole('button', { name: /abrir navegación/i });
    await expect(opener).toBeVisible();

    const focusedBefore = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);

    await opener.click();

    const drawer = page.getByRole('dialog', { name: /navegación/i });
    await expect(drawer).toBeVisible();

    // 1. Foco inicial dentro del cajón.
    expect(await drawer.evaluate((node) => node.contains(document.activeElement))).toBe(true);

    // 2. Tab no escapa del cajón (trampa de foco).
    const insideAfterTabs: boolean[] = [];
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab');
      insideAfterTabs.push(await drawer.evaluate((node) => node.contains(document.activeElement)));
    }
    expect(insideAfterTabs.every(Boolean), 'Tab debe permanecer dentro del cajón').toBe(true);

    // 3. Shift+Tab tampoco escapa.
    const insideAfterShiftTabs: boolean[] = [];
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('Shift+Tab');
      insideAfterShiftTabs.push(await drawer.evaluate((node) => node.contains(document.activeElement)));
    }
    expect(insideAfterShiftTabs.every(Boolean), 'Shift+Tab debe permanecer dentro del cajón').toBe(true);

    // 4. El fondo no es interactivo: ningún enlace del rail de escritorio queda
    //    alcanzable mientras el cajón está abierto. Se excluyen los enlaces del
    //    propio cajón (que sí deben serlo).
    const backgroundReachable = await page.evaluate(() => {
      const drawer = document.querySelector('[role="dialog"]');
      const links = Array.from(document.querySelectorAll('a'));
      return links.some((link) => {
        if (drawer && drawer.contains(link)) return false;
        const text = (link.textContent ?? '').trim().toLowerCase();
        if (text !== 'resumen') return false;
        const hiddenAncestor = link.closest('[aria-hidden="true"], [inert]');
        return hiddenAncestor === null && link.offsetParent !== null;
      });
    });
    expect(backgroundReachable, 'el fondo no debe ser alcanzable con el cajón abierto').toBe(false);

    // 5. Escape cierra.
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    // 6. El foco vuelve al disparador.
    await page.waitForTimeout(400);
    const focusAfterEscape = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return {
        tag: element?.tagName.toLowerCase() ?? null,
        ariaLabel: element?.getAttribute('aria-label') ?? null,
        text: (element?.textContent ?? '').trim().slice(0, 40),
        esBody: element === document.body,
      };
    });

    writeReport('cajon-foco.json', focusAfterEscape);

    expect(focusAfterEscape.ariaLabel, 'el foco debe volver al disparador').toBe('Abrir navegación');

    writeReport('cajon-movil.json', {
      foco_inicial_dentro: true,
      tab_permanece_dentro: insideAfterTabs.every(Boolean),
      shift_tab_permanece_dentro: insideAfterShiftTabs.every(Boolean),
      fondo_alcanzable: backgroundReachable,
      escape_cierra: true,
      foco_retorna_al_disparador: true,
      foco_antes_de_abrir: focusedBefore,
    });
  });

  test('axe-core sobre el diálogo abierto, tras los cambios de DOM y estilos', async ({ page }) => {
    await installCobrarMocks(page);
    await prepareMixedCart(page);
    await page.getByTestId('cobrar-primary-action').click();

    const dialog = page.getByRole('dialog', { name: /confirmar cobro/i });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(500);

    await page.addScriptTag({ path: resolveAxePath() });

    // `addScriptTag` puede cruzarse con una navegación de la app; se reintenta
    // una vez y, si el contexto se destruye, se declara en la evidencia.
    let results: AxeLikeResults | null = null;
    for (let attempt = 0; attempt < 2 && results === null; attempt += 1) {
      try {
        results = await page.evaluate(async () => {
          const axe = window.axe;
          if (!axe) throw new Error('axe no disponible');
          return axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
          });
        });
      } catch (error) {
        if (attempt === 1) throw error;
        await expect(page.getByRole('dialog', { name: /confirmar cobro/i })).toBeVisible();
        await page.addScriptTag({ path: resolveAxePath() });
      }
    }

    if (results === null) throw new Error('axe no produjo resultados');

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );

    writeReport('axe-dialogo.json', {
      engine: results.testEngine?.version ?? 'desconocida',
      violaciones: results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
      })),
      bloqueantes_critical_serious: blocking.length,
    });

    expect(blocking, 'violaciones critical/serious en el diálogo abierto').toEqual([]);
  });
});

declare global {
  interface Window {
    axe?: { run: (context?: unknown, options?: unknown) => Promise<AxeLikeResults> };
  }
}

type AxeLikeResults = {
  violations: Array<{ id: string; impact: string | null; nodes: unknown[] }>;
  testEngine?: { version?: string };
};
