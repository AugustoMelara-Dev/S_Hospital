import { readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

export const SEGMENTS = Object.freeze([
  { name: 'app-and-routing', roots: ['src/App.test.tsx', 'src/AppRoutes.lazy.test.ts', 'src/app'] },
  { name: 'components', roots: ['src/components'] },
  { name: 'design-system', roots: ['src/design-system'] },
  { name: 'billing', roots: ['src/features/invoices'] },
  { name: 'reports-and-receipts', roots: ['src/features/reports', 'src/features/receipt-settings', 'src/features/receipts'] },
  { name: 'admin-and-catalog', roots: ['src/features/admin', 'src/features/catalog'] },
  { name: 'cash-auth-dashboard', roots: ['src/features/cash', 'src/features/auth', 'src/features/dashboard'] },
  {
    name: 'remaining-features',
    roots: [
      'src/features/about',
      'src/features/backups',
      'src/features/help',
      'src/features/onboarding',
      'src/features/settings',
      'src/features/support',
    ],
  },
  { name: 'libraries', roots: ['src/lib'] },
  { name: 'modules', roots: ['src/modules'] },
  { name: 'shell-and-hooks', roots: ['src/shell', 'src/hooks', 'src/layout', 'src/navigation'] },
  { name: 'printing-schemas-test-support', roots: ['src/printing', 'src/schemas', 'src/test'] },
]);

export function discoverVitestFiles(srcDir) {
  const frontendDir = dirname(resolve(srcDir));
  const files = [];
  walk(resolve(srcDir), files);

  return files
    .filter((file) => /\.(?:test|spec)\.(?:ts|tsx)$/.test(file))
    .map((file) => normalizePath(relative(frontendDir, file)))
    .sort();
}

export function assignFilesToSegments(files, segments) {
  const filesBySegment = Object.fromEntries(segments.map(({ name }) => [name, []]));
  const uncovered = [];
  const duplicates = [];

  for (const file of files) {
    const matching = segments
      .filter(({ roots }) => roots.some((root) => file === root || file.startsWith(`${root}/`)))
      .map(({ name }) => name);

    if (matching.length === 0) {
      uncovered.push(file);
      continue;
    }
    if (matching.length > 1) {
      duplicates.push({ file, segments: matching });
      continue;
    }
    filesBySegment[matching[0]].push(file);
  }

  return { filesBySegment, uncovered, duplicates };
}

export function aggregateVitestReports(results) {
  const passedFiles = [];
  const failedFiles = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const result of results) {
    for (const fileResult of result.report?.testResults ?? []) {
      const assertions = fileResult.assertionResults ?? [];
      passed += assertions.filter(({ status }) => status === 'passed').length;
      failed += assertions.filter(({ status }) => status === 'failed').length;
      skipped += assertions.filter(({ status }) => ['pending', 'skipped', 'todo', 'disabled'].includes(status)).length;

      const file = normalizeReportedFile(fileResult.name);
      if (assertions.some(({ status }) => status === 'failed') || fileResult.status === 'failed') {
        failedFiles.push(file);
      } else {
        passedFiles.push(file);
      }
    }
  }

  return {
    tests: { passed, failed, skipped },
    segments: {
      passed: results.filter(({ exitCode }) => exitCode === 0).length,
      failed: results.filter(({ exitCode }) => exitCode !== 0).length,
    },
    durationMs: results.reduce((total, { durationMs }) => total + durationMs, 0),
    passedFiles: [...new Set(passedFiles)].sort(),
    failedFiles: [...new Set(failedFiles)].sort(),
  };
}

function walk(directory, files) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      walk(path, files);
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
}

function normalizePath(path) {
  return path.split(sep).join('/');
}

function normalizeReportedFile(path) {
  const normalized = normalizePath(path);
  const srcIndex = normalized.lastIndexOf('/src/');
  return srcIndex >= 0 ? normalized.slice(srcIndex + 1) : normalized;
}
