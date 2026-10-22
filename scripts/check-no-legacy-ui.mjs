import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontendDir = resolve(rootDir, 'frontend');
const frontendScript = resolve(frontendDir, 'scripts/check-no-legacy-ui.mjs');

const result = spawnSync(process.execPath, [frontendScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: frontendDir,
});

process.exit(result.status ?? (result.error ? 1 : 0));
