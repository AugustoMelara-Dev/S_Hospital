export const legacyImports = [
  '@radix-ui/',
  'lucide-react',
  'recharts',
  'sonner',
  'vaul',
  'cmdk',
  'react-day-picker',
  '@tanstack/react-table',
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
  if (mode === 'inventory' || mode === 'final') return violations;
  if (mode === 'strict') {
    return violations.filter((violation) => strictModulePrefixes.some((prefix) => violation.file.startsWith(prefix)));
  }
  throw new Error(`Modo desconocido: ${mode}`);
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
