import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SEGMENTS,
  aggregateVitestReports,
  assignFilesToSegments,
  buildVitestArgs,
  discoverVitestFiles,
} from './segmented-tests-lib.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, '..');
const resultsDir = resolve(frontendDir, 'test-results', 'segmented');
const summaryPath = resolve(frontendDir, 'test-results', 'segmented-tests-summary.json');
const vitestCli = resolve(frontendDir, 'node_modules', 'vitest', 'vitest.mjs');
const discovered = discoverVitestFiles(resolve(frontendDir, 'src'));
const assignment = assignFilesToSegments(discovered, SEGMENTS);

rmSync(resultsDir, { recursive: true, force: true });
mkdirSync(resultsDir, { recursive: true });

if (assignment.uncovered.length > 0 || assignment.duplicates.length > 0) {
  const summary = buildSummary([], assignment);
  writeSummary(summary);
  printSummary(summary);
  console.error('El manifiesto segmentado no cubre cada archivo exactamente una vez. No se ejecutó Vitest.');
  process.exit(1);
}

const startedAt = Date.now();
const results = [];

for (const segment of SEGMENTS) {
  const files = assignment.filesBySegment[segment.name];
  if (files.length === 0) {
    continue;
  }

  const outputPath = resolve(resultsDir, `${segment.name}.json`);
  const args = buildVitestArgs(vitestCli, files, outputPath);
  const segmentStartedAt = Date.now();
  console.log(`\n[segmento ${segment.name}] ${files.length} archivos`);
  const execution = spawnSync(process.execPath, args, {
    cwd: frontendDir,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });
  const report = existsSync(outputPath)
    ? JSON.parse(readFileSync(outputPath, 'utf8'))
    : { testResults: [], error: 'Vitest no produjo reporte JSON.' };

  results.push({
    segment: segment.name,
    files,
    exitCode: execution.status ?? 1,
    durationMs: Date.now() - segmentStartedAt,
    report,
  });
}

const summary = buildSummary(results, assignment, Date.now() - startedAt);
writeSummary(summary);
printSummary(summary);
process.exit(summary.segments.failed > 0 || summary.files.unreported.length > 0 ? 1 : 0);

function buildSummary(results, currentAssignment, wallDurationMs = 0) {
  const aggregate = aggregateVitestReports(results);
  const reportedFiles = new Set([...aggregate.passedFiles, ...aggregate.failedFiles]);
  const covered = Object.values(currentAssignment.filesBySegment).flat().sort();

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    files: {
      discovered: discovered.length,
      covered: covered.length,
      uncovered: currentAssignment.uncovered,
      duplicates: currentAssignment.duplicates,
      unreported: covered.filter((file) => !reportedFiles.has(file)),
      passed: aggregate.passedFiles,
      failed: aggregate.failedFiles,
    },
    tests: aggregate.tests,
    segments: {
      ...aggregate.segments,
      results: results.map(({ segment, files, exitCode, durationMs }) => ({
        name: segment,
        fileCount: files.length,
        status: exitCode === 0 ? 'passed' : 'failed',
        durationMs,
      })),
    },
    durationMs: wallDurationMs || aggregate.durationMs,
  };
}

function writeSummary(summary) {
  mkdirSync(dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
}

function printSummary(summary) {
  console.log('\n=== Regresión Vitest segmentada ===');
  console.log(`Archivos de prueba descubiertos: ${summary.files.discovered}`);
  console.log(`Archivos cubiertos: ${summary.files.covered}`);
  console.log(`Archivos no cubiertos: ${summary.files.uncovered.length}`);
  console.log(`Archivos duplicados: ${summary.files.duplicates.length}`);
  console.log(`Archivos sin reporte: ${summary.files.unreported.length}`);
  console.log(`Tests aprobados: ${summary.tests.passed}`);
  console.log(`Tests fallidos: ${summary.tests.failed}`);
  console.log(`Tests omitidos: ${summary.tests.skipped}`);
  console.log(`Segmentos aprobados: ${summary.segments.passed}`);
  console.log(`Segmentos fallidos: ${summary.segments.failed}`);
  console.log(`Duración total: ${(summary.durationMs / 1000).toFixed(1)} s`);
  console.log(`Reporte: ${summaryPath}`);
}
