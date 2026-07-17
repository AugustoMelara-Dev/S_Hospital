import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetsDir = resolve(root, 'dist', 'assets');
const maxChunkBytes = Number(process.env.BUNDLE_MAX_CHUNK_BYTES ?? 500_000);
const maxStartupGzipBytes = Number(process.env.BUNDLE_MAX_STARTUP_GZIP_BYTES ?? 500_000);
// Ant Design is the explicit application-wide UI boundary; keep measured headroom
// without relaxing the stricter startup budget.
const maxTotalGzipBytes = Number(process.env.BUNDLE_MAX_TOTAL_GZIP_BYTES ?? 1_150_000);

let files;
try {
  files = readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => {
      const content = readFileSync(resolve(assetsDir, name));
      return { name, bytes: content.length, gzipBytes: gzipSync(content).length };
    })
    .sort((a, b) => b.bytes - a.bytes);
} catch {
  process.stderr.write('Bundle budget: falta frontend/dist/assets. Ejecute npm run build primero.\n');
  process.exit(1);
}

const html = readFileSync(resolve(root, 'dist', 'index.html'), 'utf8');
const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
const totalGzipBytes = files.reduce((sum, file) => sum + file.gzipBytes, 0);
const startupFiles = files.filter((file) => html.includes(`/assets/${file.name}`));
const startupGzipBytes = startupFiles.reduce((sum, file) => sum + file.gzipBytes, 0);
const oversizedStartup = startupFiles.filter((file) => file.bytes > maxChunkBytes);
const justifiedAsync = files.filter((file) => !startupFiles.includes(file) && file.bytes > 500_000);

process.stdout.write('Bundle JavaScript:\n');
for (const file of files) {
  const startup = html.includes(`/assets/${file.name}`) ? 'inicio' : 'asíncrono';
  process.stdout.write(`- ${relative(root, resolve(assetsDir, file.name))}: ${formatBytes(file.bytes)} raw / ${formatBytes(file.gzipBytes)} gzip [${startup}]\n`);
}
process.stdout.write(`Inicio JS: ${formatBytes(startupGzipBytes)} gzip (límite ${formatBytes(maxStartupGzipBytes)})\n`);
process.stdout.write(`Total JS: ${formatBytes(totalBytes)} raw / ${formatBytes(totalGzipBytes)} gzip (límite gzip ${formatBytes(maxTotalGzipBytes)})\n`);
if (justifiedAsync.length > 0) {
  process.stdout.write(`Chunks pesados asíncronos para documentar: ${justifiedAsync.map((file) => file.name).join(', ')}\n`);
}

if (oversizedStartup.length > 0 || startupGzipBytes > maxStartupGzipBytes || totalGzipBytes > maxTotalGzipBytes) {
  if (oversizedStartup.length > 0) process.stderr.write(`Chunks de inicio sobre ${formatBytes(maxChunkBytes)}: ${oversizedStartup.map((file) => file.name).join(', ')}\n`);
  if (startupGzipBytes > maxStartupGzipBytes) process.stderr.write('El arranque JavaScript excede el presupuesto gzip.\n');
  if (totalGzipBytes > maxTotalGzipBytes) process.stderr.write('El total JavaScript excede el presupuesto gzip.\n');
  process.exit(1);
}

process.stdout.write('Bundle budget: PASS.\n');

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
