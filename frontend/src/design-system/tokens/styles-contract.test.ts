import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('styles.css design contract (IDENTIDAD_DARK_20261016 / better-ui)', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'styles.css'), 'utf8');
  // Capa de literales auditada por el gate ui-legacy: los hexes/rgb impuestos
  // por el spec viven allí y el puente solo resuelve por token.
  const tokens = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'admin', 'tokens.css'), 'utf8');
  // El bloque .dark (clase que ThemeProvider fija SIEMPRE) es la fuente canónica
  // de la elevación dark: se aísla para afirmar el valor exacto del doc §3.
  // El corte llega hasta la `}` a columna 0 (el bloque no anida reglas) y así
  // tolera los delimitadores CRLF reales del archivo.
  const darkStart = css.lastIndexOf('.dark {');
  const dark = css.slice(darkStart, css.indexOf('\n}', darkStart) + 2);

  // Puente shadcn: el bloque :root que define --background. La búsqueda con
  // regex tolera CRLF en el delimitador del archivo.
  const bridge = css.slice(css.search(/:root \{\r?\n {2}--background:/));

  it('migra el stroke global 1.75 a la tabla de icons.md', () => {
    expect(css).not.toMatch(/stroke-width:\s*1\.75/);
    expect(css).toMatch(/stroke-width:\s*var\(--icon-stroke-regular\)/);
    expect(css).toMatch(/stroke-width:\s*var\(--icon-stroke-medium\)/);
    expect(css).toMatch(/stroke-width:\s*var\(--icon-stroke-strong\)/);
  });

  it('define la elevación dark canónica (anillo blanco; 3 capas claras como fallback de papel)', () => {
    // Dark canónico (§3): sombra-como-borde + overlay de ambiente corto.
    expect(dark).toMatch(/--shadow-border:\s*0 0 0 1px oklch\(1 0 0 \/ 0\.08\)/);
    expect(dark).toMatch(/--shadow-border-hover: 0 0 0 1px oklch\(1 0 0 \/ 0\.13\)/);
    expect(dark).toMatch(/--shadow-overlay:\s*0 0 0 1px oklch\(1 0 0 \/ 0\.08\)/);
    expect(dark).toMatch(/0 12px 32px -12px oklch\(0 0 0 \/ 0\.55\)/);
    expect(dark).toMatch(/0 24px 64px -24px oklch\(0 0 0 \/ 0\.45\)/);
    // Light: excepción de papel/imprenta; el fallback de 3 capas permanece.
    expect(css).toMatch(/--shadow-border:\s*0px 0px 0px 1px oklch\(0 0 0 \/ 0\.06\)/);
    expect(css).toMatch(/--shadow-border-hover:/);
  });

  it('acota los radios de superficie auditados a <=16px', () => {
    expect(css).toMatch(/--radius-2xl:\s*0\.875rem/);
    expect(css).toMatch(/--radius-3xl:\s*0\.9375rem/);
    expect(css).toMatch(/--radius-4xl:\s*1rem/);
  });

  it('prohibe transition-all y conserva una regla global de reduced motion', () => {
    expect(css).not.toMatch(/transition:\s*all/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it('aplica tabular-nums con feature settings de cifras tabulares', () => {
    expect(css).toMatch(/font-feature-settings:\s*"tnum" 1, "lnum" 1/);
  });

  it('enlaza el puente shadcn con la identidad dark única, no con la paleta institucional R2', () => {
    expect(css).toMatch(/--ring:\s*var\(--ui-focus\)/);
    expect(css).toMatch(/--primary:\s*var\(--ui-action\)/);
    expect(css).not.toMatch(/--(?:primary|ring|accent|accent-foreground|primary-foreground):\s*var\(--institutional-/);
  });

  it('resuelve la etiqueta de relleno de acción con --ui-action-foreground (§1.3)', () => {
    expect(bridge).toMatch(/--primary-foreground:\s*var\(--ui-action-foreground\)/);
    expect(bridge).toMatch(/--sidebar-primary-foreground:\s*var\(--ui-action-foreground\)/);
  });

  it('declara la identidad como dark: color-scheme fijo y sin conmutación por clase', () => {
    expect(css).toMatch(/color-scheme:\s*dark/);
    expect(css).not.toMatch(/color-scheme:\s*light/);
    // Sin @custom-variant dark: no hay modo por clase que conmute.
    expect(css).not.toMatch(/@custom-variant dark/);
  });

  it('declara ::selection con el tintado cobalto y tinta del sistema (§8)', () => {
    expect(tokens).toMatch(/--ui-selection-tint:\s*rgb\(112 168 255 \/ 0\.28\)/);
    expect(css).toMatch(/::selection\s*\{\s*background:\s*var\(--ui-selection-tint\);\s*color:\s*var\(--ui-ink\);/s);
  });

  it('usa la serie de datos dark y no deja indigo/paletas de la identidad revocada', () => {
    expect(tokens).toMatch(/--ui-data-series-3:\s*#67CBF0/);
    expect(bridge).toMatch(/--chart-3:\s*var\(--ui-data-series-3\)/);
    for (const banned of ['#6366F1', '#EFF6FF', '#DBEAFE', '#0f766e', '#2dd4bf']) {
      expect(css).not.toMatch(new RegExp(banned, 'i'));
    }
  });
});
