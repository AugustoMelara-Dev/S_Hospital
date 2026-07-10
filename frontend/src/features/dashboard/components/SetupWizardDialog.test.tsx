import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SetupWizardDialog responsive and motion contract', () => {
  const source = readFileSync(resolve(__dirname, 'SetupWizardDialog.tsx'), 'utf8');

  it('usa un stepper responsive sin fila rígida ni separadores horizontales', () => {
    expect(source).toContain('grid grid-cols-2 gap-3 sm:grid-cols-4');
    expect(source).not.toContain('flex items-center gap-6');
    expect(source).not.toContain('h-px w-8');
  });

  it('mantiene todos sus botones con target mínimo de 44 px', () => {
    const buttonLines = source.split('\n').filter((line) => line.includes('<Button'));

    expect(buttonLines.length).toBeGreaterThan(0);
    expect(buttonLines.every((line) => line.includes('className="min-h-11'))).toBe(true);
  });

  it('mantiene todos sus campos con altura mínima de 44 px', () => {
    const buttonCount = source.match(/<Button\b/g)?.length ?? 0;
    const inputCount = source.match(/<Input\b/g)?.length ?? 0;
    const targetCount = source.match(/className="min-h-11/g)?.length ?? 0;

    expect(inputCount).toBeGreaterThan(0);
    expect(targetCount).toBe(buttonCount + inputCount);
  });

  it('presenta las etiquetas visibles con acentuación correcta', () => {
    expect(source).toContain('datos mínimos');
    expect(source).toContain('Catálogo');
    expect(source).toContain('Fecha límite');
    expect(source).toContain('Atrás');
    expect(source).toContain('Luego podrá editarla');
    expect(source).toContain('categoría, servicio');
    expect(source).toContain('iniciar la operación');
    expect(source).toContain('numeración y servicios');
  });

  it('no usa animaciones ni transición de ancho sin protección reduced motion', () => {
    expect(source).not.toMatch(/animate-(?:pulse|spin|bounce)|transition-\[width\]/);
  });
});
