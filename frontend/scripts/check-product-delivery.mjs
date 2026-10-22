import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const failures = [];
const forbidden = /Laboratorio de direcci[oó]n visual|comanda t[aá]ctica|propuestasData|Propuesta[AB]View|PropuestaSwitcher|PropuestaShell/i;

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (/^propuestas$/i.test(entry.name)) failures.push(relative(root, path));
      await inspect(path);
    } else if (/\.(?:js|tsx?|css|html|json)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)) {
      if (forbidden.test(await readFile(path, 'utf8'))) failures.push(relative(root, path));
    }
  }
}

for (const directory of ['src', 'public', 'dist']) {
  const path = resolve(root, directory);
  if (!(await stat(path).catch(() => null))?.isDirectory()) {
    failures.push(`${directory}: falta el directorio de entrega`);
  } else {
    await inspect(path);
  }
}

if (failures.length) {
  console.error(`Entrega bloqueada: laboratorio o fixtures de propuestas en producto:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Producto: src, public y dist sin laboratorio ni fixtures de propuestas.');
}
