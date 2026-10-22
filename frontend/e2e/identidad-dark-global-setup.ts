import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * Guarda dura antes de cualquier suite mutante de identidad dark. Consulta la
 * conexión efectiva de Laravel; no infiere el destino por nombre de archivo ni
 * por variables del runner. Si no es la base de laboratorio exacta, Playwright
 * aborta completo.
 *
 * Renombrado desde `azul-blanco-global-setup.ts` (identidad revocada
 * 2026-10-16); el guard y la base esperada siguen siendo los mismos.
 */
export default function identidadDarkGlobalSetup(): void {
  const expected = 'sh_ai_lab_local';
  const backendRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'backend');
  const probe = spawnSync(
    'php',
    [
      'artisan',
      'tinker',
      '--env=local',
      '--execute',
      "echo 'IDENTIDAD_DARK_DB_GUARD='.DB::connection()->getDatabaseName();",
    ],
    {
      cwd: backendRoot,
      env: { ...process.env, APP_ENV: 'local' },
      encoding: 'utf8',
      shell: false,
    },
  );

  const output = `${probe.stdout ?? ''}\n${probe.stderr ?? ''}`;
  const databaseMarker = output.match(/(?:^|\r?\n)IDENTIDAD_DARK_DB_GUARD=([^\r\n]+)/)?.[1]?.trim();
  if (probe.status !== 0 || databaseMarker !== expected) {
    throw new Error(`E2E identidad dark abortada: Laravel no confirmó la base exacta ${expected}.`);
  }
}
