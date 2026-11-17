// Starts the real FastAPI backend for the E2E suite on a throwaway SQLite DB.
//
//   node e2e/start-api.mjs
//
// Every run deletes api/storage/e2e-playwright.db, applies migrations, seeds the
// demo data (users admin/supervisor/cajero/auditor, password Hospital#2026) and
// serves on 127.0.0.1:$E2E_API_PORT (default 8765). Scheduled backups are off and
// backups go to api/storage/e2e-backups. Override the interpreter with SHS_PYTHON.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(here, '..', '..', 'api');
const port = process.env.E2E_API_PORT ?? '8765';

const venvPython =
  process.platform === 'win32' ? join(apiDir, '.venv', 'Scripts', 'python.exe') : join(apiDir, '.venv', 'bin', 'python');
const python = process.env.SHS_PYTHON ?? (existsSync(venvPython) ? venvPython : 'python');

const dbFile = join(apiDir, 'storage', 'e2e-playwright.db');
for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`, `${dbFile}-journal`]) rmSync(f, { force: true });
rmSync(join(apiDir, 'storage', 'e2e-backups'), { recursive: true, force: true });

const env = {
  ...process.env,
  SHS_DATABASE_URL: 'sqlite:///./storage/e2e-playwright.db',
  SHS_DAILY_BACKUP_TIME: 'off',
  SHS_BACKUP_DIR: './storage/e2e-backups',
  SHS_SECRET_KEY: 'e2e-secret-key-not-for-production',
  PYTHONUNBUFFERED: '1',
};

function run(args) {
  const r = spawnSync(python, ['-m', 'app.cli', ...args], { cwd: apiDir, env, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`[e2e] "python -m app.cli ${args.join(' ')}" failed (${r.status ?? r.error})`);
    process.exit(1);
  }
}

run(['migrate']);
run(['seed', '--demo']);

const server = spawn(python, ['-m', 'app.cli', 'serve', '--host', '127.0.0.1', '--port', port], {
  cwd: apiDir,
  env,
  stdio: 'inherit',
});
const stop = () => server.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stop);
server.on('exit', (code) => process.exit(code ?? 0));
