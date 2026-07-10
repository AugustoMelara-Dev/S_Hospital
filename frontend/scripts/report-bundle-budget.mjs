import { readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetsDir = resolve(root, 'dist', 'assets');
const maxChunkBytes = Number(process.env.BUNDLE_MAX_CHUNK_BYTES ?? 750_000);
const maxTotalBytes = Number(process.env.BUNDLE_MAX_TOTAL_BYTES ?? 2_800_000);

let files;
try {
  files = readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({ name, bytes: statSync(resolve(assetsDir, name)).size }))
    .sort((a, b) => b.bytes - a.bytes);
} catch {
  process.stderr.write('Bundle budget: falta frontend/dist/assets. Ejecute npm run build primero.\n');
  process.exit(1);
}

const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
const oversized = files.filter((file) => file.bytes > maxChunkBytes);

process.stdout.write('Bundle JavaScript:\n');
for (const file of files) process.stdout.write(`- ${relative(root, resolve(assetsDir, file.name))}: ${formatBytes(file.bytes)}\n`);
process.stdout.write(`Total JS: ${formatBytes(totalBytes)} (límite ${formatBytes(maxTotalBytes)})\n`);

if (oversized.length > 0 || totalBytes > maxTotalBytes) {
  if (oversized.length > 0) process.stderr.write(`Chunks sobre ${formatBytes(maxChunkBytes)}: ${oversized.map((file) => file.name).join(', ')}\n`);
  if (totalBytes > maxTotalBytes) process.stderr.write('El total JavaScript excede el presupuesto.\n');
  process.exit(1);
}

process.stdout.write('Bundle budget: PASS.\n');

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
