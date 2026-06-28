import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, mkdirSync, copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, '..');
const repoRoot = resolve(frontendDir, '..');
const backendDir = resolve(repoRoot, 'backend');
const artifactDir = resolve(frontendDir, 'test-results', 'release-e2e');
const testingDir = resolve(backendDir, 'storage', 'framework', 'testing');
const migrationHash = computeMigrationHash(backendDir);
const hashPrefix = migrationHash.slice(0, 12);
const goldenSqlitePath = resolve(testingDir, `e2e-golden-${hashPrefix}.sqlite`);
const sqlitePath = resolve(testingDir, `e2e-release-${hashPrefix}-${process.pid}.sqlite`);
const backendUrl = process.env.E2E_RELEASE_API_BASE_URL ?? 'http://127.0.0.1:18081';
const frontendUrl = process.env.E2E_RELEASE_BASE_URL ?? 'http://127.0.0.1:5174';
const e2eReleasePassword = process.env.E2E_RELEASE_PASSWORD ?? 'Password123!';
const releaseReportPath = resolve(frontendDir, 'test-results', 'release-e2e-report.json');
const playwrightReportPath = resolve(frontendDir, 'test-results', 'release-e2e-playwright.json');

mkdirSync(artifactDir, { recursive: true });
mkdirSync(testingDir, { recursive: true });

const backendEnv = buildBackendEnv(sqlitePath);

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
  E2E_RELEASE_REPORT_PATH: releaseReportPath,
};

let backendProcess;
let frontendProcess;
let exitCode = 0;

try {
  prepareGoldenDatabase();
  cloneGoldenDatabase();

  backendProcess = start('backend', 'php', ['artisan', 'serve', '--host=127.0.0.1', '--port=18081'], backendDir, backendEnv);
  await waitFor(`${backendUrl}/api/system/health`, 'Laravel E2E backend');

  frontendProcess = start('frontend', process.execPath, [resolve(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5174'], frontendDir, frontendEnv);
  await waitFor(frontendUrl, 'Vite E2E frontend');

  run(process.execPath, [resolve(frontendDir, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', '--config=playwright.release.config.ts'], frontendDir, frontendEnv);
  writeReleaseSummaryReport();
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.stack : String(error));
} finally {
  stop(frontendProcess);
  stop(backendProcess);
  cleanupDisposableSqlite(sqlitePath);
}

process.exit(exitCode);

function buildBackendEnv(databasePath) {
  return {
    ...process.env,
    APP_ENV: 'testing',
    APP_DEBUG: 'false',
    APP_KEY: process.env.APP_KEY ?? 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    APP_URL: backendUrl,
    APP_CONFIG_CACHE: resolve(backendDir, 'storage', 'framework', 'testing', 'e2e-config.php'),
    DB_CONNECTION: 'sqlite',
    DB_DATABASE: databasePath,
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
}

function prepareGoldenDatabase() {
  if (existsSync(goldenSqlitePath)) {
    console.log(`[release-e2e] Reusing golden SQLite database ${goldenSqlitePath}`);
    return;
  }

  const buildingPath = `${goldenSqlitePath}.building-${process.pid}`;
  cleanupDisposableSqlite(buildingPath);

  console.log(`[release-e2e] Building golden SQLite database for migration hash ${migrationHash}`);
  const goldenEnv = buildBackendEnv(buildingPath);
  runArtisan(['migrate:fresh', '--seed', '--force'], goldenEnv);
  runArtisan(['hospital:prepare-e2e-release-data', '--json'], goldenEnv);

  rmSync(goldenSqlitePath, { force: true });
  rmSync(`${goldenSqlitePath}-journal`, { force: true });
  copyFileSync(buildingPath, goldenSqlitePath);
  cleanupDisposableSqlite(buildingPath);
}

function cloneGoldenDatabase() {
  cleanupDisposableSqlite(sqlitePath);
  copyFileSync(goldenSqlitePath, sqlitePath);
  console.log(`[release-e2e] Cloned golden SQLite database to ${sqlitePath}`);
}

function writeReleaseSummaryReport() {
  const report = readJsonIfExists(releaseReportPath, {});
  const playwrightReport = readJsonIfExists(playwrightReportPath, null);

  if (!playwrightReport) {
    throw new Error(`Playwright release JSON report missing at ${playwrightReportPath}.`);
  }

  writeFileSync(releaseReportPath, JSON.stringify({
    ...report,
    generated_at: new Date().toISOString(),
    base_url: frontendUrl,
    api_base_url: backendUrl,
    migration_hash: migrationHash,
    golden_sqlite: goldenSqlitePath,
    playwright_report_path: playwrightReportPath,
    playwright_summary: playwrightReport.stats ?? null,
    playwright_specs: collectPlaywrightSpecs(playwrightReport),
  }, null, 2));
}

function readJsonIfExists(path, fallback) {
  if (!existsSync(path)) {
    return fallback;
  }

  return JSON.parse(readFileSync(path, 'utf8'));
}

function collectPlaywrightSpecs(report) {
  const specs = [];
  const stack = [...(report.suites ?? [])];

  while (stack.length > 0) {
    const suite = stack.shift();
    stack.push(...(suite.suites ?? []));

    for (const spec of suite.specs ?? []) {
      const tests = spec.tests ?? [];
      const unexpected = tests.some((testCase) => testCase.outcome === 'unexpected');
      const flaky = tests.some((testCase) => testCase.outcome === 'flaky');
      specs.push({
        title: spec.title,
        file: spec.file,
        status: unexpected ? 'failed' : flaky ? 'flaky' : 'passed',
      });
    }
  }

  return specs;
}

function runArtisan(args, env) {
  run('php', ['artisan', ...args], backendDir, env);
}

function cleanupDisposableSqlite(databasePath) {
  rmSync(databasePath, { force: true });
  rmSync(`${databasePath}-journal`, { force: true });
  rmSync(`${databasePath}-wal`, { force: true });
  rmSync(`${databasePath}-shm`, { force: true });
}

function computeMigrationHash(rootDir) {
  const files = [
    ...filesUnder(resolve(rootDir, 'database', 'migrations')),
    ...filesUnder(resolve(rootDir, 'database', 'seeders')),
  ];
  const hash = createHash('sha256');

  for (const file of files) {
    const normalizedPath = relative(rootDir, file).split(sep).join('/');
    hash.update(normalizedPath);
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }

  return hash.digest('hex');
}

function filesUnder(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        return filesUnder(fullPath);
      }
      if (entry.isFile()) {
        return [fullPath];
      }

      return [];
    })
    .filter((file) => statSync(file).isFile())
    .sort((left, right) => left.localeCompare(right));
}

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
