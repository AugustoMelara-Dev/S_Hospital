// fix-encoding.mjs
//
// Fixes two related problems in the frontend TS/TSX sources:
//
//  1. Mojibake: bytes that were decoded as Latin-1 then re-encoded as
//     UTF-8. The smoking gun is the sequence 0xC3 0x83 (= "Ã")
//     followed by another high byte. PowerShell's default codepage
//     on Windows hides this from casual inspection, so the audit
//     script ran a byte-level scan.
//
//  2. Missing Spanish accents: "sesion" -> "sesión", "modulo" ->
//     "módulo", etc. The audit grep matched these because PowerShell
//     printed the surrounding bytes through the wrong codepage and
//     they looked like mojibake. They are actually plain ASCII
//     typos.
//
// Run:  node scripts/fix-encoding.mjs            (apply fixes)
//       node scripts/fix-encoding.mjs --dry-run  (preview only)

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_SRC = path.resolve(__dirname, '..', 'src');

const dryRun = process.argv.includes('--dry-run');

// Map of true mojibake -> intended char. The source has 0xC3 0x83
// followed by 0xC2 0xXY which together decode to the two display
// chars "Ã" + the Latin-1 char. We match the literal two-char string
// so we don't touch unrelated content.
const MOJIBAKE = new Map([
  ['Ã¡', 'á'], ['Ã©', 'é'], ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'],
  ['Ã±', 'ñ'], ['Ã\x81', 'Á'], ['Ã\x89', 'É'], ['Ã\x8D', 'Í'],
  ['Ã\x93', 'Ó'], ['Ã\x9A', 'Ú'], ['Ã\x91', 'Ñ'],
  ['Â¿', '¿'], ['Â¡', '¡'],
]);

// Map of common Spanish words in the cashier UI that were written
// without the proper accent. Each entry is the full word boundary
// match - we never replace inside other words.
const WORD_FIXES = [
  // Common nouns / verbs
  ['\\bSesion\\b', 'Sesión'],
  ['\\bsesion\\b', 'sesión'],
  ['\\bSesiones\\b', 'Sesiones'],
  ['\\bsesiones\\b', 'sesiones'],
  ['\\bSesion[\\s,.]', 'Sesión'],   // mid-string with punctuation
  ['\\bModulo\\b', 'Módulo'],
  ['\\bmodulo\\b', 'módulo'],
  ['\\bModulos\\b', 'Módulos'],
  ['\\bmodulos\\b', 'módulos'],
  ['\\bNumero\\b', 'Número'],
  ['\\bnumero\\b', 'número'],
  ['\\bCategoria\\b', 'Categoría'],
  ['\\bcategoria\\b', 'categoría'],
  ['\\bCategorias\\b', 'Categorías'],
  ['\\bcategorias\\b', 'categorías'],
  ['\\bPagina\\b', 'Página'],
  ['\\bpagina\\b', 'página'],
  ['\\bImpresion\\b', 'Impresión'],
  ['\\bimpresion\\b', 'impresión'],
  ['\\bAnulacion\\b', 'Anulación'],
  ['\\banulacion\\b', 'anulación'],
  ['\\bValidacion\\b', 'Validación'],
  ['\\bvalidacion\\b', 'validación'],
  ['\\bReimpresion\\b', 'Reimpresión'],
  ['\\breimpresion\\b', 'reimpresión'],
  ['\\bRestauracion\\b', 'Restauración'],
  ['\\brestauracion\\b', 'restauración'],
  ['\\bCancelacion\\b', 'Cancelación'],
  ['\\bcancelacion\\b', 'cancelación'],
  ['\\bOperacion\\b', 'Operación'],
  ['\\boperacion\\b', 'operación'],
  ['\\bFacturacion\\b', 'Facturación'],
  ['\\bfacturacion\\b', 'facturación'],
  ['\\bInstalacion\\b', 'Instalación'],
  ['\\binstalacion\\b', 'instalación'],
  ['\\bConfiguracion\\b', 'Configuración'],
  ['\\bconfiguracion\\b', 'configuración'],
  ['\\bImplementacion\\b', 'Implementación'],
  ['\\bimplementacion\\b', 'implementación'],
  ['\\bEjecucion\\b', 'Ejecución'],
  ['\\bejecucion\\b', 'ejecución'],
  ['\\bContrasena\\b', 'Contraseña'],
  ['\\bcontrasena\\b', 'contraseña'],
  ['\\bCatalogo\\b', 'Catálogo'],
  ['\\bcatalogo\\b', 'catálogo'],
  ['\\bReverso?\\b', 'Reverso'],
  ['\\bMas\\b', 'Más'],
  ['\\bmas\\b', 'más'],
  // Adjacent / past participles used in UI
  ['\\bAbrir caja\\b', 'Abrir caja'],
];

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

async function fixFile(file) {
  const original = await readFile(file, 'utf-8');
  let updated = original;
  let total = 0;
  const perPattern = {};

  for (const [mojibake, intended] of MOJIBAKE) {
    const re = new RegExp(mojibake, 'g');
    const matches = updated.match(re);
    if (matches) {
      perPattern[mojibake + ' -> ' + intended] = matches.length;
      total += matches.length;
      updated = updated.replace(re, intended);
    }
  }

  for (const [pattern, replacement] of WORD_FIXES) {
    const re = new RegExp(pattern, 'g');
    const matches = updated.match(re);
    if (matches) {
      perPattern[pattern + ' -> ' + replacement] = matches.length;
      total += matches.length;
      updated = updated.replace(re, replacement);
    }
  }

  if (total > 0) {
    if (dryRun) {
      console.log(`[dry-run] ${file}: ${total} replacements`);
      for (const [k, v] of Object.entries(perPattern)) {
        console.log(`    ${k}: ${v}x`);
      }
    } else {
      updated = updated.replace(/^\uFEFF/, '');
      await writeFile(file, updated, 'utf-8');
      console.log(`[fixed] ${file}: ${total} replacements`);
    }
  }
  return total;
}

async function main() {
  const files = await walk(FRONTEND_SRC);
  let grand = 0;
  for (const f of files) {
    grand += await fixFile(f);
  }
  console.log('');
  console.log(`Total replacements: ${grand} across ${files.length} files`);
  if (dryRun) {
    console.log('(dry-run mode: no files were modified)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
