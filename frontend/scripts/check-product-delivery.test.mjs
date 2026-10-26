import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkProductDelivery, readDistDirectory } from './check-product-delivery.mjs';

test('validates the selected candidate build without reading the active dist', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hospital-delivery-'));
  try {
    for (const directory of ['src', 'public', 'dist', 'candidate']) await mkdir(join(root, directory));
    await writeFile(join(root, 'dist', 'active.js'), 'PropuestaSwitcher');
    await writeFile(join(root, 'candidate', 'app.js'), 'console.log("hospital")');
    assert.deepEqual(await checkProductDelivery(root, join(root, 'candidate')), []);
    assert.deepEqual(await checkProductDelivery(root), [join('dist', 'active.js')]);
    await writeFile(join(root, 'candidate', 'app.js'), 'PropuestaSwitcher');
    assert.deepEqual(await checkProductDelivery(root, 'candidate'), [join('candidate', 'app.js')]);
    assert.match((await checkProductDelivery(root, 'missing'))[0], /falta el directorio/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('dist option preserves the default and rejects incomplete or unknown arguments', () => {
  assert.equal(readDistDirectory([]), 'dist');
  assert.equal(readDistDirectory(['--dist-dir', '../candidate']), '../candidate');
  assert.equal(readDistDirectory(['--dist-dir=../candidate']), '../candidate');
  for (const args of [['--dist-dir'], ['--dist-dir='], ['--wrong', 'dist']]) {
    assert.throws(() => readDistDirectory(args), /Uso:/);
  }
});
