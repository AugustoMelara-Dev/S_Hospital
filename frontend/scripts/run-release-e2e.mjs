import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, mkdirSync, openSync, closeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, '..');
const repoRoot = resolve(frontendDir, '..');
const backendDir = resolve(repoRoot, 'backend');
const artifactDir = resolve(frontendDir, 'test-results', 'release-e2e');
const sqlitePath = resolve(backendDir, 'storage', 'framework', 'testing', 'e2e-release.sqlite');
const backendUrl = process.env.E2E_RELEASE_API_BASE_URL ?? 'http://127.0.0.1:18081';
const frontendUrl = process.env.E2E_RELEASE_BASE_URL ?? 'http://127.0.0.1:5174';
const e2eReleasePassword = process.env.E2E_RELEASE_PASSWORD ?? 'Password123!';

mkdirSync(artifactDir, { recursive: true });
mkdirSync(dirname(sqlitePath), { recursive: true });
closeSync(openSync(sqlitePath, 'a'));

const backendEnv = {
  ...process.env,
  APP_ENV: 'testing',
  APP_DEBUG: 'false',
  APP_KEY: process.env.APP_KEY ?? 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  APP_URL: backendUrl,
  APP_CONFIG_CACHE: resolve(backendDir, 'storage', 'framework', 'testing', 'e2e-config.php'),
  DB_CONNECTION: 'sqlite',
  DB_DATABASE: sqlitePath,
  DB_URL: '',
  CACHE_STORE: 'array',
  QUEUE_CONNECTION: 'sync',
  SESSION_DRIVER: 'database',
  BROADCAST_CONNECTION: 'null',
  PULSE_ENABLED: 'false',
  TELESCOPE_ENABLED: 'false',
  NIGHTWATCH_ENABLED: 'false',
  E2E_SEED_PASSWORD: process.env.E2E_SEED_PASSWORD ?? e2eReleasePassword,
};

const frontendEnv = {
  ...process.env,
  VITE_DEV_API_PROXY_TARGET: backendUrl,
  PLAYWRIGHT_EXTERNAL_SERVER: '1',
  PLAYWRIGHT_BASE_URL: frontendUrl,
  E2E_RELEASE_BASE_URL: frontendUrl,
  E2E_RELEASE_API_BASE_URL: backendUrl,
  E2E_RELEASE_LOGIN: process.env.E2E_RELEASE_LOGIN ?? 'cajero.e2e',
  E2E_RELEASE_PASSWORD: e2eReleasePassword,
  E2E_RELEASE_ALLOW_MUTATIONS: '1',
  E2E_RELEASE_REPORT_PATH: resolve(frontendDir, 'test-results', 'release-e2e-report.json'),
};

let backendProcess;
let frontendProcess;
let exitCode = 0;

try {
  run('php', ['artisan', 'migrate:fresh', '--seed', '--force'], backendDir, backendEnv);
  run('php', ['artisan', 'hospital:prepare-e2e-release-data', '--json'], backendDir, backendEnv);

  backendProcess = start('backend', 'php', ['artisan', 'serve', '--host=127.0.0.1', '--port=18081'], backendDir, backendEnv);
  await waitFor(`${backendUrl}/api/system/health`, 'Laravel E2E backend');

  frontendProcess = start('frontend', process.execPath, [resolve(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5174'], frontendDir, frontendEnv);
  await waitFor(frontendUrl, 'Vite E2E frontend');

  run(process.execPath, [resolve(frontendDir, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', '--config=playwright.release.config.ts'], frontendDir, frontendEnv);
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.stack : String(error));
} finally {
  stop(frontendProcess);
  stop(backendProcess);
}

process.exit(exitCode);

function run(command, args, cwd, env) {
  const printable = `${command} ${args.join(' ')}`;
  console.log(`[release-e2e] ${printable}`);
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`${printable} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function start(name, command, args, cwd, env) {
  const log = createWriteStream(resolve(artifactDir, `${name}.log`), { flags: 'w' });
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.releaseLog = log;
  child.on('exit', (code) => {
    log.write(`\n[release-e2e] ${name} exited with code ${code}\n`);
  });

  return child;
}

async function waitFor(url, label) {
  const deadline = Date.now() + 120_000;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`[release-e2e] ${label} ready at ${url}`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
  }

  throw new Error(`${label} did not become ready at ${url}: ${lastError}`);
}

function stop(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.releaseLog?.end();
    return;
  }

  child.kill('SIGTERM');
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.releaseLog?.end();
}
