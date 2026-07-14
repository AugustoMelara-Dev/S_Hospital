import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const migratedFiles = [
  'src/design-system/providers/DesignSystemProvider.tsx',
  'src/design-system/themes/institutionalTheme.ts',
  'src/design-system/antd/theme.ts',
  'src/design-system/index.ts',
];

const forbidden = [
  [/\brounded(?:-[\w[\]/.:-]+)?\b/g, 'clase rounded-*'],
  [/\bshadow(?:-[\w[\]/.:-]+)?\b/g, 'clase shadow-*'],
  [/\b(?:bg|from|via|to)-gradient-[\w-]+\b/g, 'gradiente'],
  [/style\s*=\s*\{\{/g, 'estilo inline visual'],
  [/#[\da-fA-F]{3,8}\b/g, 'color literal fuera del tema'],
];

const violations = [];
for (const relative of migratedFiles) {
  const source = readFileSync(resolve(root, relative), 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    for (const [pattern, label] of forbidden) {
      pattern.lastIndex = 0;
      if (pattern.test(line) && !relative.includes('/themes/')) {
        violations.push(`${relative}:${index + 1}: ${label}`);
      }
    }
  });
}

if (violations.length) {
  process.stderr.write(`${violations.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`UI rules: ${migratedFiles.length} archivos institucionales conformes.\n`);
