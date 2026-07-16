import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';

import {
  SEGMENTS,
  aggregateVitestReports,
  assignFilesToSegments,
  discoverVitestFiles,
} from './segmented-tests-lib.mjs';

const frontendDir = resolve(import.meta.dirname, '..');

test('the explicit manifest covers every current Vitest file exactly once', () => {
  const files = discoverVitestFiles(resolve(frontendDir, 'src'));
  const assignment = assignFilesToSegments(files, SEGMENTS);

  assert.equal(files.length, 138);
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
