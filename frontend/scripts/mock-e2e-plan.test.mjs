import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMockE2eRuns } from './mock-e2e-plan.mjs';

test('mock E2E covers shell, billing, catalog and administration without release credentials', () => {
  const runs = buildMockE2eRuns();
  const serialized = JSON.stringify(runs);

  assert.match(serialized, /accessibility\.spec\.ts/);
  assert.match(serialized, /new-invoice-flow\.spec\.ts/);
  assert.match(serialized, /invoice-history-flow\.spec\.ts/);
  assert.match(serialized, /catalog-flow\.spec\.ts/);
  assert.match(serialized, /users-flow\.spec\.ts/);
  assert.match(serialized, /print-profiles\.spec\.ts/);
  assert.match(serialized, /reports-flow\.spec\.ts/);
  assert.match(serialized, /backups-flow\.spec\.ts/);
  assert.match(serialized, /supporting-pages-flow\.spec\.ts/);
  assert.doesNotMatch(serialized, /PASSWORD|SEED|secret/i);
  assert.equal(runs.length, 3);
});
