import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

// List of migrated files that must be 100% clean of legacy imports and rounded/shadow/gradient classes
const migratedFiles = new Set([
  'src/design-system/providers/DesignSystemProvider.tsx',
  'src/design-system/antd/theme.ts',
  'src/design-system/tokens/institutional-tokens.css',
  'src/design-system/index.ts',
  'src/App.tsx',
  'src/components/shared/design-system.stories.tsx',
]);

const legacyImports = [
  '@radix-ui/',
  'lucide-react',
  'recharts',
  'sonner',
  'vaul',
  'cmdk',
  'react-day-picker',
  '@tanstack/react-table',
];

const prohibitedClasses = [
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

const offenders = [];

for (const fileRel of migratedFiles) {
  const fileAbs = resolve(projectRoot, fileRel);
  let source;
  try {
    source = readFileSync(fileAbs, 'utf8');
  } catch (err) {
    continue; // File does not exist yet or has been moved
  }

  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    // 1. Check legacy imports
    for (const lib of legacyImports) {
      if (line.includes(lib) && !line.includes('// Allow legacy')) {
        offenders.push(`${fileRel}:${index + 1}: Importación legacy prohibida de "${lib}"`);
      }
    }

    // 2. Check prohibited Tailwind classes
    if (!fileRel.endsWith('.css')) {
      for (const cls of prohibitedClasses) {
        const regex = new RegExp(`\\b${cls}\\b`);
        if (regex.test(line)) {
          offenders.push(`${fileRel}:${index + 1}: Clase visual prohibida "${cls}" (Geometría debe ser border-radius: 0)`);
        }
      }
    }

    // 3. Check inline border-radius styles
    if (line.includes('borderRadius') && !line.includes('borderRadius: 0') && !line.includes('borderRadiusLG: 0') && !line.includes('borderRadiusSM: 0') && !line.includes('borderRadiusXS: 0') && !line.includes('borderRadiusOuter: 0') && !line.includes('// Allow inline radius')) {
      offenders.push(`${fileRel}:${index + 1}: Estilo de borderRadius inline no autorizado`);
    }
  });
}

if (offenders.length > 0) {
  process.stderr.write(`\x1b[31m[QUALITY GATE FAILED] Violaciones de diseño institucional detectadas:\x1b[0m\n${offenders.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`\x1b[32m[QUALITY GATE PASSED] ${migratedFiles.size} archivos migrados validados con éxito.\x1b[0m\n`);
process.exit(0);
