import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterViolationsForMode, scanSource, strictModulePrefixes } from './ui-legacy-audit.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const excludedDirs = new Set(['node_modules', 'coverage', 'dist', '.storybook', 'i18n', 'printing']);
const mode = readArgument('--mode') ?? 'inventory';
const format = readArgument('--format') ?? 'text';

if (!['inventory', 'strict', 'final'].includes(mode)) {
  process.stderr.write(`Modo no soportado: ${mode}. Use inventory, strict o final.\n`);
  process.exit(2);
}

const srcRoot = resolve(projectRoot, 'src');
const files = await walk(srcRoot);
const allViolations = [];

for (const absolutePath of files) {
  const relativePath = absolutePath.slice(projectRoot.length + 1).replace(/\\/g, '/');
  try {
    allViolations.push(...scanSource(relativePath, await readFile(absolutePath, 'utf8')));
  } catch (error) {
    process.stderr.write(`No se pudo auditar ${relativePath}: ${String(error)}\n`);
    process.exit(2);
  }
}

const violations = filterViolationsForMode(allViolations, mode);
const summary = summarize(violations, files.length, mode);

if (format === 'json') {
  process.stdout.write(`${JSON.stringify({ summary, strictModulePrefixes, violations }, null, 2)}\n`);
} else {
  printTextReport(summary, violations);
}

if (mode === 'inventory') process.exit(0);
process.exit(violations.length > 0 ? 1 : 0);

async function walk(directory) {
  const output = [];
  let entries;
  try {
    entries = await readdir(directory);
  } catch {
    return output;
  }

  for (const entry of entries) {
    if (excludedDirs.has(entry)) continue;
    const absolutePath = resolve(directory, entry);
    let entryStat;
    try {
      entryStat = await stat(absolutePath);
    } catch {
      continue;
    }
    if (entryStat.isDirectory()) output.push(...await walk(absolutePath));
    else if (/\.(ts|tsx)$/.test(entry)) output.push(absolutePath);
  }
  return output.sort();
}

function readArgument(name) {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function summarize(violations, scannedFiles, selectedMode) {
  const byKind = Object.create(null);
  const byModule = Object.create(null);
  for (const violation of violations) {
    byKind[violation.kind] = (byKind[violation.kind] ?? 0) + 1;
    byModule[violation.module] = (byModule[violation.module] ?? 0) + 1;
  }
  return {
    mode: selectedMode,
    scannedFiles,
    violationCount: violations.length,
    byKind,
    byModule,
  };
}

function printTextReport(summary, violations) {
  const label = summary.mode === 'inventory'
    ? 'INVENTORY'
    : summary.violationCount === 0 ? 'QUALITY GATE PASSED' : 'QUALITY GATE FAILED';
  const stream = summary.mode !== 'inventory' && summary.violationCount > 0 ? process.stderr : process.stdout;
  stream.write(`[${label}] modo=${summary.mode}; ${summary.scannedFiles} archivos; ${summary.violationCount} violaciones.\n`);
  for (const violation of violations) {
    const detail = violation.dependency ?? violation.cssClass ?? violation.kind;
    stream.write(`${violation.file}:${violation.line}: [${violation.module}/${violation.risk}] ${violation.message} (${detail})\n`);
  }
  if (summary.mode === 'strict') {
    stream.write(`Módulos estrictos: ${strictModulePrefixes.join(', ')}\n`);
  }
}
