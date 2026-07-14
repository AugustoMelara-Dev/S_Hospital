import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildMockE2eRuns } from './mock-e2e-plan.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, '..');
const playwrightCli = resolve(frontendDir, 'node_modules', '@playwright', 'test', 'cli.js');

for (const run of buildMockE2eRuns()) {
  console.log(`\n[mock-e2e] Ejecutando ${run.label}`);
  const result = spawnSync(process.execPath, [playwrightCli, ...run.args], {
    cwd: frontendDir,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    console.error(`[mock-e2e] ${run.label} falló con código ${result.status ?? 'desconocido'}.`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n[mock-e2e] Shell, Facturación, Catálogo, Administración, Recibos, Reportes, Respaldos, Ayuda, Soporte y Acerca de aprobados.');
