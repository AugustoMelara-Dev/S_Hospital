import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSource } from './ui-legacy-audit.mjs';

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = resolve(frontendRoot, '..');
const srcRoot = resolve(frontendRoot, 'src');
const excluded = new Set(['node_modules', 'coverage', 'dist', '.storybook', 'i18n', 'printing']);
const files = await walk(srcRoot);
const violations = [];

for (const file of files) {
  const projectPath = relative(frontendRoot, file).replaceAll('\\', '/');
  violations.push(...scanSource(projectPath, await readFile(file, 'utf8')));
}

const rows = violations.map((violation, index) => {
  const owner = violation.file.startsWith('src/components/ui/') ? 'A' : 'B';
  const dependency = violation.dependency ?? 'sin dependencia externa';
  const cssClass = violation.cssClass ?? 'sin clase';
  const folder = dirname(violation.file).replaceAll('\\', '/');
  const component = violation.file.split('/').at(-1);
  const action = violation.kind === 'legacy-import'
    ? 'migrar consumidor y eliminar import/dependencia'
    : violation.kind === 'legacy-motion'
      ? 'sustituir motion por transición institucional/Ant Design'
      : violation.kind === 'inline-radius'
        ? 'usar geometría global borderRadius: 0'
        : 'eliminar clase visual y usar token/componente institucional';
  return { id: index + 1, ...violation, dependency, cssClass, folder, component, owner, action };
});

const lines = [
  '# Manifiesto final de violaciones legacy del frontend',
  '',
  `Generado desde el gate global \`inventory\`. Archivos auditados: **${files.length}**. Violaciones iniciales: **${rows.length}**.`,
  '',
  rows.length === 177
    ? 'La línea base coincide exactamente con 177 violaciones en 406 archivos.'
    : `Diferencia contra la línea base aceptada (177/406): ${rows.length - 177 >= 0 ? '+' : ''}${rows.length - 177} violaciones y ${files.length - 406 >= 0 ? '+' : ''}${files.length - 406} archivos, causada por cambios presentes en la worktree antes de esta ejecución.`,
  '',
  '## Resumen por dependencia', '', groupTable(rows, (row) => row.dependency),
  '', '## Resumen por módulo', '', groupTable(rows, (row) => row.module),
  '', '## Resumen por carpeta', '', groupTable(rows, (row) => row.folder),
  '', '## Resumen por clase', '', groupTable(rows, (row) => row.cssClass),
  '', '## Resumen por componente', '', groupTable(rows, (row) => row.component),
  '', '## Resumen por severidad', '', groupTable(rows, (row) => row.risk),
  '', '## Asignación sin solapamientos', '',
  '| Subagente | Archivos | Violaciones | Propiedad |',
  '|---|---:|---:|---|',
  ...['A', 'B'].map((owner) => {
    const owned = rows.filter((row) => row.owner === owner);
    return `| ${owner} | ${new Set(owned.map((row) => row.file)).size} | ${owned.length} | ${owner === 'A' ? '`src/components/ui/**`' : 'runtime residual fuera de `src/components/ui/**`'} |`;
  }),
  '', '## Inventario individual', '',
  '| # | Archivo | Línea | Módulo | Tipo | Import o clase | Consumidor | Dependencia | Subagente | Acción | Test | Estado | Commit |',
  '|---:|---|---:|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((row) => `| ${row.id} | \`${row.file}\` | ${row.line} | ${row.module} | ${row.kind} | \`${row.dependency !== 'sin dependencia externa' ? row.dependency : row.cssClass}\` | \`${row.consumer}\` | ${row.dependency} | ${row.owner} | ${row.action} | gate focal + suite segmentada | backlog | pendiente |`),
  '',
];

const destination = resolve(repoRoot, 'docs/frontend-final-legacy-manifest.md');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `${lines.join('\n')}\n`, 'utf8');
process.stdout.write(`Manifest generated: ${rows.length} violations across ${files.length} files.\n`);

function groupTable(items, selector) {
  const counts = new Map();
  for (const item of items) counts.set(selector(item), (counts.get(selector(item)) ?? 0) + 1);
  return ['| Grupo | Violaciones |', '|---|---:|', ...[...counts].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `| \`${key}\` | ${count} |`)].join('\n');
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory)) {
    if (excluded.has(entry)) continue;
    const absolute = resolve(directory, entry);
    const details = await stat(absolute);
    if (details.isDirectory()) output.push(...await walk(absolute));
    else if (/\.(ts|tsx)$/.test(entry)) output.push(absolute);
  }
  return output.sort();
}
