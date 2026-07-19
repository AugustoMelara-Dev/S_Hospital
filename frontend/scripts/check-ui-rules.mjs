import { readdirSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const uiRoot = resolve(root, 'src/components/ui');

export function scanUiRuleSource(relative, source) {
  const violations = [];
  const rules = [
    [/\bspace-[xy]-[^\s"']+/g, 'usar gap en lugar de space-x/space-y'],
    [/\bdark:(?:bg|text|border|ring|outline|fill|stroke)-[^\s"']+/g, 'usar tokens semánticos en lugar de colores dark:*'],
    [/(?:@import\s+|url\(\s*)["']?https?:\/\//g, 'recurso remoto incompatible con operación offline'],
  ];

  source.split(/\r?\n/).forEach((line, index) => {
    for (const [pattern, message] of rules) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) violations.push(`${relative}:${index + 1}: ${message}`);
    }
  });

  return violations;
}

export function scanAppSemanticRules(relative, source) {
  const violations = [];

  source.split(/\r?\n/).forEach((line, index) => {
    if (/\btext-secondary(?!-)/.test(line)) {
      violations.push(`${relative}:${index + 1}: secondary es una superficie; usar text-primary o secondary-foreground para contenido`);
    }
  });

  return violations;
}

function collectUiFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectUiFiles(absolute);
    return ['.ts', '.tsx', '.css'].includes(extname(entry.name)) ? [absolute] : [];
  });
}

export function checkUiRules() {
  const files = [resolve(root, 'src/styles.css'), ...collectUiFiles(uiRoot)];
  const foundationViolations = files.flatMap((absolute) => {
    const relative = absolute.slice(root.length + 1).replaceAll('\\', '/');
    return scanUiRuleSource(relative, readFileSync(absolute, 'utf8'));
  });
  const appFiles = collectUiFiles(resolve(root, 'src'));
  const semanticViolations = appFiles.flatMap((absolute) => {
    const relative = absolute.slice(root.length + 1).replaceAll('\\', '/');
    return scanAppSemanticRules(relative, readFileSync(absolute, 'utf8'));
  });
  const violations = [...foundationViolations, ...semanticViolations];

  return { files: appFiles, violations };
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { files, violations } = checkUiRules();
  if (violations.length) {
    process.stderr.write(`${violations.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`UI rules: ${files.length} archivos shadcn conformes.\n`);
}
