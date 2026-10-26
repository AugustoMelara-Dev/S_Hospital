import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Contrato de movimiento e interacción de la base "Panel administrativo"
 * (better-ui/animations.md, enter-exit.md, icon-transitions.md, icons.md,
 * performance.md, surfaces.md y emil-design-eng).
 *
 * Es una prueba de texto sobre las fuentes reales: no valida runtime, pero
 * congela las recetas exactas (curvas, duraciones, escala y reducción de
 * movimiento) para que no se degraden en silencio.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (...segments: string[]) => readFileSync(join(here, ...segments), 'utf8');

const tokens = read('tokens.css');
const adminComponents = read('components.tsx');
const topBar = read('..', '..', 'shell', 'admin', 'AdminSidebar.tsx');
const loginView = read('..', '..', 'features', 'auth', 'LoginView.tsx');
const styles = read('..', '..', 'styles.css');
const uiDialog = read('..', '..', 'components', 'ui', 'dialog.tsx');
const uiAlertDialog = read('..', '..', 'components', 'ui', 'alert-dialog.tsx');
const uiSelect = read('..', '..', 'components', 'ui', 'select.tsx');
const uiPopover = read('..', '..', 'components', 'ui', 'popover.tsx');
const uiDropdownMenu = read('..', '..', 'components', 'ui', 'dropdown-menu.tsx');
const uiSheet = read('..', '..', 'components', 'ui', 'sheet.tsx');

describe('admin motion contract (better-ui / emil)', () => {
  it('define las curvas custom y nunca usa ease-in como timing de UI', () => {
    expect(tokens).toMatch(/--ui-ease-out:\s*cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
    expect(tokens).toMatch(/--ui-ease-in-out:\s*cubic-bezier\(0\.77, 0, 0\.175, 1\)/);
    // `ease-in` como función de tiempo literal queda prohibida en la base admin.
    expect(tokens).not.toMatch(/timing-function:[^;]*\bease-in\b/);
  });

  it('mantiene las duraciones en rango: UI 120–200 ms, press 100–160 ms', () => {
    const duration = (name: string) => {
      const match = tokens.match(new RegExp(`--ui-duration-${name}:\\s*(\\d+)ms`));
      expect(match, `falta --ui-duration-${name}`).not.toBeNull();
      return Number(match![1]);
    };

    expect(duration('state')).toBeGreaterThanOrEqual(120);
    expect(duration('state')).toBeLessThanOrEqual(200);
    expect(duration('overlay-in')).toBeGreaterThanOrEqual(120);
    expect(duration('overlay-in')).toBeLessThanOrEqual(200);
    expect(duration('press')).toBeGreaterThanOrEqual(100);
    expect(duration('press')).toBeLessThanOrEqual(160);
    // La salida es más rápida que la entrada (emil: exits softer and faster).
    expect(duration('overlay-out')).toBeLessThan(duration('overlay-in'));
  });

  it('aplica scale(0.96) exacto en :active y lo omite con foco de teclado', () => {
    expect(tokens).toMatch(/--ui-press-scale:\s*0\.96/);
    expect(tokens).toMatch(/\[data-ui-press\]:not\(:disabled\):not\(:focus-visible\):active/);
    expect(tokens).toMatch(/scale:\s*var\(--ui-press-scale\)/);
    // El botón primario de acceso y el submit de búsqueda llevan el atributo.
    expect(loginView).toContain('data-ui-press');
    expect(adminComponents).toContain('data-ui-press');
    expect(topBar).toContain('data-ui-press');
  });

  it('no entra desde scale(0): el modal permanece centrado y el movimiento es por transición', () => {
    expect(tokens).not.toMatch(/scale\(0\)/);
    // Overlays admin sin clases keyframe: el movimiento vive en la receta
    // compartida por data-state de styles.css (no en el componente).
    expect(adminComponents).not.toMatch(/animate-(in|out)\b/);
    expect(adminComponents).not.toMatch(/zoom-(in|out)-\d/);
    expect(adminComponents).not.toMatch(/fade-(in|out)-\d/);
    // El modal permanece centrado: sin transform-origin de disparador.
    expect(adminComponents).toMatch(/-translate-x-1\/2 -translate-y-1\/2/);
  });

  it('hace los popovers origin-aware con --transform-origin', () => {
    expect(tokens).toMatch(/transform-origin:\s*var\(--transform-origin\)/);
    expect(tokens).toContain('--radix-dropdown-menu-content-transform-origin');
  });

  it('cruza iconos con los valores exactos de icon-transitions.md', () => {
    expect(tokens).toMatch(/--ui-duration-icon:\s*300ms/);
    expect(tokens).toMatch(/--ui-ease-icon:\s*cubic-bezier\(0\.2, 0, 0, 1\)/);
    expect(tokens).toMatch(/scale:\s*0\.25/);
    expect(tokens).toMatch(/filter:\s*blur\(4px\)/);
    expect(loginView).toContain('data-ui-icon-swap');
  });

  it('convierte el reduced motion en menos movimiento, no en cero color', () => {
    expect(tokens).toMatch(/prefers-reduced-motion:\s*reduce/);
    const reduced = tokens.slice(tokens.indexOf('prefers-reduced-motion: reduce'));
    const reducedPress = reduced.match(/\[data-ui-press\]\s*\{([^}]+)\}/)?.[1];
    expect(reducedPress).toBeDefined();
    expect(reducedPress).toMatch(/transition-property:\s*background-color, border-color, color\s*!important/);
    // Habilitar un botón debe restaurar el contraste inmediatamente, también
    // con movimiento reducido; la opacidad se reserva al intercambio de iconos.
    expect(reducedPress).not.toMatch(/transition-property:[^;]*\bopacity\b/);
    const press = tokens.match(/\[data-ui-press\]\s*\{([^}]+)\}/)?.[1];
    expect(press).toBeDefined();
    expect(press).not.toMatch(/transition-property:[^;]*\bopacity\b/);
    // Los overlays pierden zoom/desplazamiento; el fundido lo acota la regla
    // global (transition-duration 0.001 ms), no una animación keyframe.
    expect(reduced).toMatch(/scale:\s*1\s*!important/);
    expect(reduced).not.toMatch(/filter:\s*blur\(4px\)\s*!important/);
  });

  it('encierra el hover en puntero fino y no usa transition: all', () => {
    expect(styles).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    for (const source of [tokens, adminComponents, topBar, loginView, styles]) {
      expect(source).not.toMatch(/transition:\s*all/);
      expect(source).not.toMatch(/transition-all/);
      expect(source).not.toMatch(/will-change:\s*all/);
    }
  });

  it('usa currentColor y un solo set de iconos (lucide) con trazo por peso', () => {
    expect(styles).toMatch(/stroke-width:\s*var\(--icon-stroke-regular\)/);
    expect(styles).toMatch(/stroke-width:\s*var\(--icon-stroke-medium\)/);
    expect(adminComponents).toMatch(/from 'lucide-react'/);
    expect(loginView).toMatch(/from 'lucide-react'/);
    expect(loginView).toContain('data-icon');
  });
});

/**
 * T-FE-08: los primitivos Radix/shadcn compartidos por los overlays admin
 * (dialog, select, popover, dropdown-menu, sheet) ya no usan las clases keyframe
 * de `tw-animate-css`; transicionan por `data-state` contra los tokens
 * `--ui-duration-overlay-*` y `--ui-ease-out`. El cierre habla español y su
 * foco es el anillo admin, no el teal de R2.
 */
describe('shared overlay primitives (components/ui)', () => {
  const sources: Record<string, string> = {
    dialog: uiDialog,
    'alert-dialog': uiAlertDialog,
    select: uiSelect,
    popover: uiPopover,
    'dropdown-menu': uiDropdownMenu,
    sheet: uiSheet,
  };

  it('no conserva clases keyframe de tw-animate-css', () => {
    for (const [name, source] of Object.entries(sources)) {
      expect(source, name).not.toMatch(/animate-(in|out)\b/);
      expect(source, name).not.toMatch(/zoom-(in|out)-\d/);
      expect(source, name).not.toMatch(/fade-(in|out)-\d/);
      expect(source, name).not.toMatch(/slide-(in|out)-(from|to)/);
    }
  });

  it('define la receta de transición por data-state con tokens admin', () => {
    expect(styles).toMatch(/\[data-slot='dialog-content'\]\[data-state='open'\]/);
    expect(styles).toMatch(/\[data-slot='dialog-content'\]\[data-state='closed'\]/);
    expect(styles).toMatch(/--ui-duration-overlay-in/);
    expect(styles).toMatch(/--ui-duration-overlay-out/);
    expect(styles).toMatch(/--ui-ease-out/);
    expect(styles).toMatch(/@starting-style/);
    expect(styles).toMatch(/transform-origin:\s*var\(--transform-origin\)/);
  });

  it('neutraliza el cierre: nombre accesible en español y foco admin', () => {
    expect(uiDialog).toContain('sr-only">Cerrar</span>');
    expect(uiDialog).not.toContain('sr-only">Close</span>');
    expect(uiSheet).toContain('sr-only">Cerrar</span>');
    expect(styles).toMatch(/\[data-slot='dialog-close'\]:focus-visible/);
    expect(styles).toMatch(/outline:\s*var\(--ui-focus-ring-width\) solid var\(--ui-focus\)/);
  });
});
