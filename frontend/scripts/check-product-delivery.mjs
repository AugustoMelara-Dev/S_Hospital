import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const forbidden = /Laboratorio de direcci[oó]n visual|comanda t[aá]ctica|propuestasData|Propuesta[AB]View|PropuestaSwitcher|PropuestaShell/i;

export async function checkProductDelivery(projectRoot, distDirectory = 'dist') {
  const failures = [];
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (/^propuestas$/i.test(entry.name)) failures.push(relative(projectRoot, path));
        await inspect(path);
      } else if (/\.(?:js|tsx?|css|html|json)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)) {
        if (forbidden.test(await readFile(path, 'utf8'))) failures.push(relative(projectRoot, path));
      }
    }
  }
  for (const directory of ['src', 'public', distDirectory]) {
    const path = resolve(projectRoot, directory);
    if (!(await stat(path).catch(() => null))?.isDirectory()) {
      failures.push(`${directory}: falta el directorio de entrega`);
    } else {
      await inspect(path);
    }
  }
  return failures;
}

export function readDistDirectory(args) {
  if (args.length === 0) return 'dist';
  if (args.length === 2 && args[0] === '--dist-dir' && args[1].trim()) return args[1];
  if (args.length === 1 && args[0].startsWith('--dist-dir=') && args[0].slice(11).trim()) return args[0].slice(11);
  throw new Error('Uso: node scripts/check-product-delivery.mjs [--dist-dir <directorio>]');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const failures = await checkProductDelivery(root, readDistDirectory(process.argv.slice(2)));
    if (failures.length) {
      console.error(`Entrega bloqueada: laboratorio o fixtures de propuestas en producto:\n${failures.join('\n')}`);
      process.exitCode = 1;
    } else {
      console.log('Producto: src, public y dist sin laboratorio ni fixtures de propuestas.');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
