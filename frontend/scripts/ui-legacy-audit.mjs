export const legacyImports = [
  '@radix-ui/',
  'lucide-react',
  'recharts',
  'sonner',
  'vaul',
  'cmdk',
  'motion/react',
  'react-day-picker',
  '@tanstack/react-table',
  '@tanstack/react-virtual',
];

export const prohibitedClasses = [
  'rounded-sm',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-full',
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'shadow-xl',
  'shadow-2xl',
  'bg-gradient-to',
];

export const strictModulePrefixes = [
  'src/shell/',
  'src/features/auth/',
  'src/features/dashboard/',
  'src/features/cash/',
  'src/features/invoices/',
  'src/features/catalog/',
  'src/features/admin/',
  'src/features/backups/',
  'src/features/help/',
  'src/features/support/',
  'src/features/about/',
  'src/features/receipt-settings/',
  'src/features/receipts/',
  'src/printing/',
  'src/modules/receipts/',
  'src/features/reports/',
  'src/modules/reports/',
  'src/modules/accounting/',
];

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

  if (/(?:^|\/)[^/]*(?:Compat|Legacy|Old|V1|Adapter|Antd|Sheet)[^/]*\.(?:ts|tsx)$/.test(file)
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
    for (const dependency of legacyImports) {
      if (line.includes(dependency) && !line.trim().startsWith('// Allow legacy')) {
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

    for (const cssClass of prohibitedClasses) {
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
    const broadVisualClasses = isModuleDeclaration
      ? []
      : line.match(/\b(?:rounded|shadow|from|via|to)(?:-[\w[\].:/%-]+)+\b|\bbackdrop-blur(?:-[\w[\].:/%-]+)?\b|\bglass\b/g) ?? [];
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

    const arbitraryClasses = line.match(/\b[\w-]+-\[[^\]\r\n]+\]/g) ?? [];
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

    const localPaletteClasses = isModuleDeclaration
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

    if (!file.startsWith('src/design-system/')
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

    if (/\bstyle\s*=\s*\{\{/.test(line)) {
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
      || file.startsWith('src/design-system/tokens/');
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

    const radiusProperty = line.match(/\bborderRadius(?:LG|SM|XS|Outer)?\s*:\s*([^,}\n]+)/);
    if (radiusProperty && !/^0(?:\s|$)/.test(radiusProperty[1].trim()) && !line.includes('// Allow inline radius')) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'inline-radius',
        module,
        message: 'estilo de borderRadius distinto de cero no autorizado',
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
