import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMockE2eRuns } from './mock-e2e-plan.mjs';

test('mock E2E covers the new admin product without release credentials', () => {
  const runs = buildMockE2eRuns();
  const serialized = JSON.stringify(runs);

  assert.match(serialized, /cobrar-flow\.spec\.ts/);
  assert.match(serialized, /recibos-flow\.spec\.ts/);
  assert.match(serialized, /caja-flow\.spec\.ts/);
  assert.match(serialized, /reportes-flow\.spec\.ts/);
  assert.match(serialized, /rbac-admin\.spec\.ts/);
  assert.match(serialized, /a11y-admin\.spec\.ts/);
  assert.match(serialized, /a11y-command-palette\.spec\.ts/);
  assert.match(serialized, /contrast-regression\.spec\.ts/);
  assert.doesNotMatch(serialized, /PASSWORD|SEED|secret/i);
  assert.equal(runs.length, 4);
});
