import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';

import {
  SEGMENTS,
  aggregateVitestReports,
  assignFilesToSegments,
  buildVitestArgs,
  discoverVitestFiles,
} from './segmented-tests-lib.mjs';

const frontendDir = resolve(import.meta.dirname, '..');

test('the explicit manifest covers every current Vitest file exactly once', () => {
  const files = discoverVitestFiles(resolve(frontendDir, 'src'));
  const assignment = assignFilesToSegments(files, SEGMENTS);

  assert.equal(files.length, 140);
  assert.deepEqual(assignment.uncovered, []);
  assert.deepEqual(assignment.duplicates, []);
  assert.equal(
    Object.values(assignment.filesBySegment).flat().length,
    files.length,
  );
});

test('assignment exposes both uncovered and duplicate files', () => {
  const assignment = assignFilesToSegments(
    ['src/a.test.ts', 'src/b.test.ts'],
    [
      { name: 'first', roots: ['src/a.test.ts'] },
      { name: 'second', roots: ['src/a.test.ts'] },
    ],
  );

  assert.deepEqual(assignment.uncovered, ['src/b.test.ts']);
  assert.deepEqual(assignment.duplicates, [{
    file: 'src/a.test.ts',
    segments: ['first', 'second'],
  }]);
});

test('aggregation counts assertions and files without trusting Vitest suite totals', () => {
  const summary = aggregateVitestReports([
    {
      segment: 'one',
      durationMs: 20,
      exitCode: 0,
      report: {
        testResults: [{
          name: 'C:/repo/src/a.test.ts',
          assertionResults: [
            { status: 'passed' },
            { status: 'pending' },
          ],
        }],
      },
    },
    {
      segment: 'two',
      durationMs: 30,
      exitCode: 1,
      report: {
        testResults: [{
          name: 'C:/repo/src/b.test.ts',
          assertionResults: [{ status: 'failed' }],
        }],
      },
    },
  ]);

  assert.equal(summary.tests.passed, 1);
  assert.equal(summary.tests.failed, 1);
  assert.equal(summary.tests.skipped, 1);
  assert.equal(summary.segments.passed, 1);
  assert.equal(summary.segments.failed, 1);
  assert.equal(summary.durationMs, 50);
  assert.deepEqual(summary.passedFiles, ['src/a.test.ts']);
  assert.deepEqual(summary.failedFiles, ['src/b.test.ts']);
});

test('Vitest arguments use two isolated workers with file parallelism', () => {
  const args = buildVitestArgs(
    'C:/repo/node_modules/vitest/vitest.mjs',
    ['src/a.test.ts', 'src/b.test.tsx'],
    'C:/repo/test-results/segment.json',
  );

  assert.deepEqual(args.slice(0, 4), [
    'C:/repo/node_modules/vitest/vitest.mjs',
    'run',
    'src/a.test.ts',
    'src/b.test.tsx',
  ]);
  assert.ok(args.includes('--reporter=json'));
  assert.ok(args.includes('--outputFile=C:/repo/test-results/segment.json'));
  assert.ok(args.includes('--pool=forks'));
  assert.ok(args.includes('--maxWorkers=2'));
  assert.ok(args.includes('--fileParallelism'));
  assert.ok(args.includes('--testTimeout=30000'));
  assert.ok(!args.includes('--no-file-parallelism'));
});

test('the Windows full-suite command delegates to the maintained segmented runner', () => {
  const packageJson = JSON.parse(readFileSync(resolve(frontendDir, 'package.json'), 'utf8'));

  assert.equal(packageJson.scripts['test:full:windows'], 'npm run test:segmented');
});

test('coverage commands isolate the unit project from Storybook browser tests', () => {
  const packageJson = JSON.parse(readFileSync(resolve(frontendDir, 'package.json'), 'utf8'));

  for (const scriptName of ['test:coverage', 'test:coverage:check']) {
    const command = packageJson.scripts[scriptName];
    assert.match(command, /(?:^|\s)--config vitest\.unit\.config\.ts(?:\s|$)/);
    assert.match(command, /(?:^|\s)--maxWorkers=2(?:\s|$)/);
    assert.match(command, /(?:^|\s)--fileParallelism(?:\s|$)/);
    assert.doesNotMatch(command, /--no-file-parallelism/);
  }

  const unitConfig = readFileSync(resolve(frontendDir, 'vitest.unit.config.ts'), 'utf8');
  assert.match(unitConfig, /name:\s*['"]unit['"]/);
  assert.doesNotMatch(unitConfig, /storybookTest|@storybook/);
});
