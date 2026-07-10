import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)));
const forbidden = [
  'layout/AppShell',
  'layout/Sidebar',
  'layout/Topbar',
  'react-hot-toast',
];
const excludedDirectories = new Set(['node_modules', 'dist', 'coverage', 'test-results', 'playwright-report', '.git']);
const extensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx', '.json']);

const files = walk(projectRoot);
const offenders = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    for (const token of forbidden) {
      if (line.includes(token)) offenders.push(`${relative(projectRoot, file)}:${index + 1}: ${token}`);
    }
  });
}

if (offenders.length > 0) {
  process.stderr.write(`Presentación legacy detectada:\n${offenders.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`UI legacy guard: ${files.length} archivos verificados.\n`);

function walk(directory) {
  const entries = [];
  for (const name of readdirSync(directory)) {
    if (excludedDirectories.has(name)) continue;
    const path = resolve(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) entries.push(...walk(path));
    else if (extensions.has(extensionOf(name)) && !path.endsWith('check-no-legacy-ui.mjs')) entries.push(path);
  }
  return entries;
}

function extensionOf(name) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot);
}
