import { describe, expect, it } from 'vitest';
import { filterViolationsForMode, scanSource } from './ui-legacy-audit.mjs';

describe('ui legacy audit', () => {
  it('accepts institutional zero-radius tokens and flags non-zero radius', () => {
    expect(scanSource('src/design-system/themes/theme.ts', 'const token = { borderRadiusLG: 0 };')).toEqual([]);
    expect(scanSource('src/design-system/themes/theme.ts', "const primary = '#0f766e';")).toEqual([]);
    expect(scanSource('src/example.tsx', 'const style = { borderRadius: 8 };')).toEqual([
      expect.objectContaining({ kind: 'inline-radius', file: 'src/example.tsx', line: 1 }),
    ]);
  });

  it('allows color literals only in centralized token files, including CSS', () => {
    expect(scanSource('src/design-system/tokens/institutional-tokens.css', ':root { --brand: #0f766e; }')).toEqual([]);
    expect(scanSource('src/features/reports/report.css', '.report { color: #0f766e; }')).toEqual([
      expect.objectContaining({ kind: 'color-literal', file: 'src/features/reports/report.css' }),
    ]);
  });

  it('reports imports and prohibited visual classes with structured ownership', () => {
    const violations = scanSource(
      'src/features/reports/Report.tsx',
      "import { X } from 'lucide-react';\n<div className=\"rounded-xl shadow-md\" />",
    );

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'legacy-import', dependency: 'lucide-react', module: 'reports' }),
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'rounded-xl', phaseOwner: 'reports' }),
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'shadow-md', risk: 'medium' }),
    ]));
  });

  it('limits strict mode to declared migrated modules while final mode keeps all violations', () => {
    const violations = [
      ...scanSource('src/features/invoices/History.tsx', "import 'lucide-react';"),
      ...scanSource('src/features/reports/Report.tsx', "import 'lucide-react';"),
    ];

    expect(filterViolationsForMode(violations, 'inventory')).toHaveLength(2);
    expect(filterViolationsForMode(violations, 'strict')).toHaveLength(2);
    expect(filterViolationsForMode(violations, 'final')).toHaveLength(2);
  });

  it('keeps test fixtures out of runtime strict and final gates', () => {
    const violations = scanSource('src/features/receipts/fixture.test.tsx', "const color = '#fff';");

    expect(filterViolationsForMode(violations, 'inventory')).toHaveLength(1);
    expect(filterViolationsForMode(violations, 'strict')).toHaveLength(0);
    expect(filterViolationsForMode(violations, 'final')).toHaveLength(0);
  });

  it('flags every replaced dependency and broad prohibited visual utility family', () => {
    const violations = scanSource(
      'src/shared/LegacySurface.tsx',
      [
        "import { useVirtualizer } from '@tanstack/react-virtual';",
        '<div className="rounded-none shadow-inner bg-gradient-to-r from-red-500 via-white to-blue-500 backdrop-blur-sm glass w-[37px]" />',
      ].join('\n'),
    );

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'legacy-import', dependency: '@tanstack/react-virtual' }),
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'rounded-none' }),
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'shadow-inner' }),
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'from-red-500' }),
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'via-white' }),
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'to-blue-500' }),
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'backdrop-blur-sm' }),
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'glass' }),
      expect.objectContaining({ kind: 'arbitrary-tailwind', cssClass: 'w-[37px]' }),
    ]));
  });

  it('flags compatibility surfaces, color literals and inline visual styles', () => {
    const violations = scanSource(
      'src/shared/DialogCompat.tsx',
      "export const DialogCompat = () => <div style={{ color: '#fff' }}>compat</div>;",
    );

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'compat-surface' }),
      expect.objectContaining({ kind: 'inline-style' }),
      expect.objectContaining({ kind: 'color-literal' }),
    ]));
  });

  it('flags bare backdrop blur, local palette classes and manual visual wrappers', () => {
    const violations = scanSource(
      'src/features/example/Example.tsx',
      'const Button = () => <div className="backdrop-blur bg-white text-amber-200 border-slate-300" />;',
    );

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'backdrop-blur' }),
      expect.objectContaining({ kind: 'local-palette-class', cssClass: 'bg-white' }),
      expect.objectContaining({ kind: 'local-palette-class', cssClass: 'text-amber-200' }),
      expect.objectContaining({ kind: 'local-palette-class', cssClass: 'border-slate-300' }),
      expect.objectContaining({ kind: 'manual-visual-wrapper' }),
    ]));
  });

  it('does not interpret module specifiers as visual utility classes', () => {
    expect(scanSource('src/printing/usePrint.ts', "import { useReactToPrint } from 'react-to-print';")).toEqual([]);
  });

  it.each(['settingsAntd.tsx', 'DialogLegacy.tsx', 'ButtonAdapter.tsx', 'OldPanel.tsx', 'V1Card.tsx', 'ServiceSheet.tsx'])(
    'flags forbidden parallel visual surface %s',
    (name) => {
      expect(scanSource(`src/shared/${name}`, 'export const Surface = () => null;')).toEqual([
        expect.objectContaining({ kind: 'compat-surface' }),
      ]);
    },
  );
});
