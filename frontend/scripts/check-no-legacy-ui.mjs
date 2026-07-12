import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const excludedDirs = new Set(['node_modules', 'coverage', 'dist', '.storybook', 'i18n', 'printing', 'test_output.txt']);
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
const motionImport = 'motion/react';
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
const exemptedFiles = new Set([
  'src/components/ui/accordion.tsx',
  'src/components/ui/alert-dialog.tsx',
  'src/components/ui/alert.tsx',
  'src/components/ui/avatar.tsx',
  'src/components/ui/badge.tsx',
  'src/components/ui/breadcrumb.tsx',
  'src/components/ui/button.tsx',
  'src/components/ui/calendar.tsx',
  'src/components/ui/card.tsx',
  'src/components/ui/chart.tsx',
  'src/components/ui/checkbox.tsx',
  'src/components/ui/collapsible.tsx',
  'src/components/ui/command.tsx',
  'src/components/ui/data-table.tsx',
  'src/components/ui/dialog.tsx',
  'src/components/ui/drawer.tsx',
  'src/components/ui/dropdown-menu.tsx',
  'src/components/ui/empty.tsx',
  'src/components/ui/form-field.tsx',
  'src/components/ui/form-section.tsx',
  'src/components/ui/input-group.tsx',
  'src/components/ui/input.tsx',
  'src/components/ui/label.tsx',
  'src/components/ui/menu-bar.tsx',
  'src/components/ui/metric-card.tsx',
  'src/components/ui/money-text.tsx',
  'src/components/ui/pagination.tsx',
  'src/components/ui/popover.tsx',
  'src/components/ui/progress.tsx',
  'src/components/ui/radio-group.tsx',
  'src/components/ui/scroll-area.tsx',
  'src/components/ui/select.tsx',
  'src/components/ui/separator.tsx',
  'src/components/ui/sheet.tsx',
  'src/components/ui/skeleton.tsx',
  'src/components/ui/sonner.tsx',
  'src/components/ui/spinner.tsx',
  'src/components/ui/states.tsx',
  'src/components/ui/switch.tsx',
  'src/components/ui/table.tsx',
  'src/components/ui/tabs.tsx',
  'src/components/ui/textarea.tsx',
  'src/components/ui/toggle-group.tsx',
  'src/components/ui/toggle.tsx',
  'src/components/ui/tooltip.tsx',
]);

async function walk(dir, base = dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (excludedDirs.has(entry)) continue;
    const full = resolve(dir, entry);
    let s;
    try { s = await stat(full); } catch { continue; }
    if (s.isDirectory()) {
      out.push(...await walk(full, base));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

const srcRoot = resolve(projectRoot, 'src');
const files = await walk(srcRoot);
const offenders = [];
let scanned = 0;

for (const abs of files) {
  const rel = abs.slice(projectRoot.length + 1).replace(/\\/g, '/');
  scanned++;
  let source;
  try {
    source = stripBlockComments(await readFile(abs, 'utf8'));
  } catch {
    continue;
  }
  const isExempted = exemptedFiles.has(rel);

  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const lib of legacyImports) {
      if (line.includes(lib)) {
        if (line.trim().startsWith('// Allow legacy')) continue;
        offenders.push(`${rel}:${index + 1}: importación legacy prohibida de "${lib}"`);
      }
    }
    if (line.includes(motionImport)) {
      offenders.push(`${rel}:${index + 1}: uso de "${motionImport}" (usar Ant Design motion/transitions)`);
    }
    if (!isExempted) {
      for (const cls of prohibitedClasses) {
        const regex = new RegExp(`\\b${cls}\\b`);
        if (regex.test(line)) {
          offenders.push(`${rel}:${index + 1}: clase visual prohibida "${cls}" (geometría debe ser border-radius: 0)`);
        }
      }
    }
    if (line.includes('borderRadius') && !line.includes('borderRadius: 0') && !line.includes('// Allow inline radius')) {
      offenders.push(`${rel}:${index + 1}: estilo de borderRadius inline no autorizado`);
    }
  });
}

if (offenders.length > 0) {
  process.stderr.write(`\x1b[31m[QUALITY GATE FAILED] ${offenders.length} violaciones en ${scanned} archivos escaneados:\x1b[0m\n${offenders.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`[QUALITY GATE PASSED] ${scanned} archivos auditados, 0 violaciones. Exempted: ${exemptedFiles.size}.\n`);
process.exit(0);
