import { describe, expect, it } from 'vitest';
import { filterViolationsForMode, scanSource } from './ui-legacy-audit.mjs';

describe('ui legacy audit', () => {
  it('accepts the modern shadcn radius and shadow vocabulary', () => {
    expect(scanSource('src/components/ui/card.tsx', '<div className="rounded-xl shadow-sm" />')).toEqual([]);
    expect(scanSource('src/design-system/patterns/Panel.tsx', '<section className="rounded-xl shadow-sm" />')).toEqual([]);
    expect(scanSource('src/design-system/themes/theme.ts', 'const token = { borderRadiusLG: 12 };')).toEqual([]);
  });

  it('allows color literals only in centralized token files, including CSS', () => {
    expect(scanSource('src/design-system/tokens/institutional-tokens.css', ':root { --brand: #0f766e; }')).toEqual([]);
    expect(scanSource('src/features/reports/report.css', '.report { color: #0f766e; }')).toEqual([
      expect.objectContaining({ kind: 'color-literal', file: 'src/features/reports/report.css' }),
    ]);
  });

  it('allows the approved shadcn stack and reports every replaced dependency', () => {
    const approved = scanSource(
      'src/components/ui/chart.tsx',
      [
        "import { Slot } from 'radix-ui';",
        "import { Check } from 'lucide-react';",
        "import { LineChart } from 'recharts';",
        "import { toast } from 'sonner';",
      ].join('\n'),
    );
    expect(approved).toEqual([]);

    const violations = scanSource(
      'src/features/reports/Report.tsx',
      [
        "import { Button } from 'antd';",
        "import { SaveOutlined } from '@ant-design/icons';",
        "import { AgGridReact } from 'ag-grid-react';",
        "import * as echarts from 'echarts';",
      ].join('\n'),
    );
    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'legacy-import', dependency: 'antd' }),
      expect.objectContaining({ kind: 'legacy-import', dependency: '@ant-design/icons' }),
      expect.objectContaining({ kind: 'legacy-import', dependency: 'ag-grid-react' }),
      expect.objectContaining({ kind: 'legacy-import', dependency: 'echarts' }),
    ]));
  });

  it('limits strict mode to migrated surfaces while final mode keeps all runtime violations', () => {
    const violations = [
      ...scanSource('src/components/ui/button.tsx', "import 'antd';"),
      ...scanSource('src/features/reports/Report.tsx', "import 'echarts';"),
    ];

    expect(filterViolationsForMode(violations, 'inventory')).toHaveLength(2);
    expect(filterViolationsForMode(violations, 'strict')).toHaveLength(1);
    expect(filterViolationsForMode(violations, 'final')).toHaveLength(2);
  });

  it('keeps migrated shell and authentication surfaces in strict mode', () => {
    const violations = [
      ...scanSource('src/shell/LegacyShell.tsx', "import 'antd';"),
      ...scanSource('src/features/auth/LegacyLogin.tsx', "import '@ant-design/icons';"),
    ];

    expect(filterViolationsForMode(violations, 'strict')).toHaveLength(2);
  });

  it('keeps migrated billing and receipt surfaces in strict mode', () => {
    const violations = [
      ...scanSource('src/features/invoices/components/LegacyPayment.tsx', "import 'antd';"),
      ...scanSource('src/features/receipts/LegacyPreview.tsx', "import '@ant-design/icons';"),
    ];

    expect(filterViolationsForMode(violations, 'strict')).toHaveLength(2);
  });

  it('keeps test fixtures out of runtime strict and final gates', () => {
    const violations = scanSource('src/components/ui/fixture.test.tsx', "import 'antd';");

    expect(filterViolationsForMode(violations, 'inventory')).toHaveLength(1);
    expect(filterViolationsForMode(violations, 'strict')).toHaveLength(0);
    expect(filterViolationsForMode(violations, 'final')).toHaveLength(0);
  });

  it('flags gradients, glass, arbitrary dimensions and local palette classes outside primitives', () => {
    const violations = scanSource(
      'src/features/example/Example.tsx',
      '<div className="bg-gradient-to-r from-red-500 via-white to-blue-500 backdrop-blur-sm glass w-[37px]" />',
    );

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'prohibited-class', cssClass: 'bg-gradient-to' }),
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

  it('does not interpret module specifiers as visual utility classes', () => {
    expect(scanSource('src/printing/usePrint.ts', "import { useReactToPrint } from 'react-to-print';")).toEqual([]);
  });

  it('flags native interactive controls in product UI but allows official primitives', () => {
    const violations = scanSource(
      'src/features/invoices/ManualControls.tsx',
      '<><button>Guardar</button><details><summary>Detalle</summary></details></>',
    );

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'native-interactive-control', dependency: 'button' }),
      expect.objectContaining({ kind: 'native-interactive-control', dependency: 'details' }),
    ]));
    expect(scanSource('src/components/ui/button.tsx', '<button data-slot="button" />')).toEqual([]);
  });

  it('flags application tables outside exact semantic and primitive exceptions', () => {
    expect(scanSource('src/features/admin/PermissionMatrix.tsx', '<table />')).toEqual([
      expect.objectContaining({ kind: 'native-application-table', dependency: 'table' }),
    ]);
    expect(scanSource('src/components/ui/table.tsx', '<table data-slot="table" />')).toEqual([]);
  });

  it.each([
    'src/features/receipts/ReceiptPreview.tsx',
    'src/features/receipt-settings/components/ReceiptSettingsPreview.tsx',
    'src/features/reports/components/PaymentMethodPanel.tsx',
    'src/features/reports/components/TrendChart.tsx',
  ])('allows the documented semantic table in %s', (file) => {
    expect(scanSource(file, '<table />')).toEqual([]);
  });

  it.each(['settingsAntd.tsx', 'DialogLegacy.tsx', 'ButtonAdapter.tsx', 'OldPanel.tsx', 'V1Card.tsx'])(
    'flags forbidden parallel visual surface %s',
    (name) => {
      expect(scanSource(`src/shared/${name}`, 'export const Surface = () => null;')).toEqual([
        expect.objectContaining({ kind: 'compat-surface' }),
      ]);
    },
  );

  it('allows Sheet as the target responsive shadcn pattern', () => {
    expect(scanSource('src/features/catalog/ServiceSheet.tsx', 'export const ServiceSheet = () => null;')).toEqual([]);
  });
});
