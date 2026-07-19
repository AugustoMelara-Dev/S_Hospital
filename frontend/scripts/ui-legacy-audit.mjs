export const legacyImports = [
  'antd',
  '@ant-design/icons',
  'ag-grid-community',
  'ag-grid-react',
  'echarts',
];

export const prohibitedClasses = [
  'bg-gradient-to',
];

export const strictModulePrefixes = [
  'src/App.tsx',
  'src/components/ui/',
  'src/design-system/components/',
  'src/design-system/patterns/',
  'src/design-system/providers/',
  'src/hooks/use-mobile.ts',
  'src/hooks/useTheme.ts',
  'src/shell/',
  'src/features/auth/',
  'src/features/backups/',
  'src/features/cash/',
  'src/features/catalog/',
  'src/features/dashboard/',
  'src/features/reports/',
  'src/features/support/',
  'src/modules/reports/',
  'src/modules/accounting/',
  'src/features/onboarding/',
  'src/features/invoices/components/',
  'src/features/invoices/InvoiceHistoryView.tsx',
  'src/features/invoices/history/',
  'src/features/receipts/',
  'src/components/AppErrorBoundary.tsx',
  'src/components/PermissionGate.tsx',
  'src/components/keyboard-shortcuts-palette.tsx',
  'src/layout/components/UserMenu.tsx',
  'src/navigation/appNavigation.ts',
];

const semanticNativeTableFiles = new Set([
  'src/features/receipts/ReceiptPreview.tsx',
  'src/features/receipt-settings/components/ReceiptSettingsPreview.tsx',
  'src/features/reports/components/PaymentMethodPanel.tsx',
  'src/features/reports/components/TrendChart.tsx',
]);

export function classifyModule(file) {
  const feature = file.match(/^src\/features\/([^/]+)\//)?.[1];
  if (feature) return feature;
  if (file.startsWith('src/design-system/')) return 'design-system';
  if (file.startsWith('src/components/ui/')) return 'ui-primitives';
  if (file.startsWith('src/shell/')) return 'shell';
  if (file.startsWith('src/layout/')) return 'layout';
  if (file.startsWith('src/modules/')) return file.split('/')[2] ?? 'modules';
  return 'shared';
}

export function scanSource(file, rawSource) {
  const source = stripBlockComments(rawSource);
  const module = classifyModule(file);
  const violations = [];
  const isUiPrimitive = file.startsWith('src/components/ui/');

  if (/(?:^|\/)[^/]*(?:Compat|Legacy|Old|V1|Adapter|Antd)[^/]*\.(?:ts|tsx)$/.test(file)
    || /\b\w*(?:Compat|Legacy|Old|V1)\w*\b/.test(source)) {
    violations.push(makeViolation({
      file,
      line: findLine(source, /\b\w*(?:Compat|Legacy|Old|V1)\w*\b/),
      kind: 'compat-surface',
      module,
      message: 'superficie de compatibilidad legacy prohibida',
      risk: 'high',
    }));
  }

  source.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    for (const match of isUiPrimitive ? [] : line.matchAll(/<(button|input|select|textarea|dialog|details)\b/g)) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'native-interactive-control',
        dependency: match[1],
        module,
        message: `control interactivo HTML "${match[1]}" fuera de los primitivos shadcn`,
        risk: 'high',
      }));
    }

    if (!isUiPrimitive && !semanticNativeTableFiles.has(file) && /<table\b/.test(line)) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'native-application-table',
        dependency: 'table',
        module,
        message: 'tabla visual de aplicacion fuera de shadcn DataTable',
        risk: 'medium',
      }));
    }

    for (const dependency of legacyImports) {
      const dependencyPattern = new RegExp(
        `(?:from\\s+|import\\s*|require\\(\\s*)['"]${escapeRegex(dependency)}(?:/|['"])`,
      );
      if (dependencyPattern.test(line) && !line.trim().startsWith('// Allow legacy')) {
        violations.push(makeViolation({
          file,
          line: lineNumber,
          kind: 'legacy-import',
          dependency,
          module,
          message: `importación legacy prohibida de "${dependency}"`,
          risk: 'high',
        }));
      }
    }

    if (line.includes('motion/react')) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'legacy-motion',
        dependency: 'motion/react',
        module,
        message: 'uso de "motion/react" (usar Ant Design motion/transitions)',
        risk: 'medium',
      }));
    }

    for (const cssClass of isUiPrimitive ? [] : prohibitedClasses) {
      if (new RegExp(`\\b${escapeRegex(cssClass)}\\b`).test(line)) {
        violations.push(makeViolation({
          file,
          line: lineNumber,
          kind: 'prohibited-class',
          cssClass,
          module,
          message: `clase visual prohibida "${cssClass}"`,
          risk: cssClass.startsWith('bg-gradient') ? 'high' : 'medium',
        }));
      }
    }

    const isModuleDeclaration = /^\s*(?:import|export)\b/.test(line);
    const broadVisualClasses = isModuleDeclaration || isUiPrimitive
      ? []
      : line.match(/\b(?:from|via|to)(?:-[\w[\].:/%-]+)+\b|\bbackdrop-blur(?:-[\w[\].:/%-]+)?\b|\bglass\b/g) ?? [];
    for (const cssClass of broadVisualClasses) {
      if (prohibitedClasses.includes(cssClass)) continue;
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'prohibited-class',
        cssClass,
        module,
        message: `clase visual prohibida "${cssClass}"`,
        risk: /^(?:from|via|to|bg-gradient)/.test(cssClass) ? 'high' : 'medium',
      }));
    }

    const arbitraryClasses = isUiPrimitive ? [] : line.match(/\b[\w-]+-\[[^\]\r\n]+\]/g) ?? [];
    for (const cssClass of arbitraryClasses) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'arbitrary-tailwind',
        cssClass,
        module,
        message: `valor arbitrario de Tailwind prohibido "${cssClass}"`,
        risk: 'medium',
      }));
    }

    const localPaletteClasses = isModuleDeclaration || isUiPrimitive
      ? []
      : line.match(/\b(?:text|bg|border|fill|stroke|ring|outline|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d+)?\b/g) ?? [];
    for (const cssClass of localPaletteClasses) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'local-palette-class',
        cssClass,
        module,
        message: `clase de paleta local prohibida "${cssClass}"`,
        risk: 'medium',
      }));
    }

    if (!file.startsWith('src/design-system/') && !isUiPrimitive
      && /\b(?:function|const)\s+(?:Button|Alert|Badge|Dialog|Drawer|Sheet|Toast|Chart|Calendar|Command)\b/.test(line)) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'manual-visual-wrapper',
        module,
        message: 'wrapper visual manual con API legacy prohibido',
        risk: 'high',
      }));
    }

    if (!isUiPrimitive && /\bstyle\s*=\s*\{\{/.test(line)) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'inline-style',
        module,
        message: 'estilo inline visual prohibido',
        risk: 'medium',
      }));
    }

    const isCentralTokenFile = file.startsWith('src/design-system/themes/')
      || file.startsWith('src/design-system/tokens/')
      || isUiPrimitive;
    if (!isCentralTokenFile && /(?:#[\da-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\()/.test(line)) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'color-literal',
        module,
        message: 'color literal fuera de tokens institucionales',
        risk: 'medium',
      }));
    }

  });

  return violations;
}

export function filterViolationsForMode(violations, mode) {
  if (mode === 'inventory') return violations;
  if (mode === 'final') return violations.filter((violation) => !/\.(?:test|spec|stories)\.(?:ts|tsx)$/.test(violation.file));
  if (mode === 'strict') {
    return violations.filter((violation) => strictModulePrefixes.some((prefix) => violation.file.startsWith(prefix))
      && !/\.(?:test|spec|stories)\.(?:ts|tsx)$/.test(violation.file));
  }
  throw new Error(`Modo desconocido: ${mode}`);
}

function findLine(source, pattern) {
  const index = source.search(pattern);
  return index < 0 ? 1 : source.slice(0, index).split(/\r?\n/).length;
}

function makeViolation(violation) {
  return {
    ...violation,
    consumer: violation.file,
    phaseOwner: violation.module,
    status: 'backlog',
  };
}

function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
