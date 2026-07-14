import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

export const releaseDatabaseHashPaths = [
  ['database', 'migrations'],
  ['database', 'seeders'],
  ['app', 'Console', 'Commands', 'PrepareE2eReleaseDataCommand.php'],
  ['app', 'Http', 'Controllers', 'AuthController.php'],
  ['app', 'Http', 'Middleware', 'StripApiReadSessionCookies.php'],
  ['app', 'Http', 'Requests', 'Auth'],
  ['bootstrap', 'app.php'],
  ['config', 'sanctum.php'],
  ['config', 'session.php'],
  ['routes', 'api.php'],
  ['routes', 'web.php'],
];

export function computeReleaseDatabaseHash(rootDir) {
  const hash = createHash('sha256');

  for (const file of releaseDatabaseHashInputs(rootDir)) {
    const normalizedPath = relative(rootDir, file).split(sep).join('/');
    hash.update(normalizedPath);
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }

  return hash.digest('hex');
}

export function releaseDatabaseHashInputs(rootDir) {
  const files = releaseDatabaseHashPaths.flatMap((segments) => filesForPath(resolve(rootDir, ...segments)));
  return Array.from(new Set(files)).sort((left, right) => left.localeCompare(right));
}

function filesForPath(path) {
  if (!existsSync(path)) {
    return [];
  }

  if (statSync(path).isFile()) {
    return [path];
  }

  return filesUnder(path);
}

function filesUnder(dir) {
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