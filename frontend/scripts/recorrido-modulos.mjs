// Recorrido de todas las pantallas por rol contra el laboratorio local.
// Uso: node scripts/recorrido-modulos.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:18362';
const out = process.argv[3] ?? 'recorrido';
const password = process.env.RECORRIDO_PASSWORD ?? '';
mkdirSync(out, { recursive: true });

const rutas = [
  ['resumen', '/resumen'],
  ['cobrar', '/cobrar'],
  ['recibos', '/recibos'],
  ['caja', '/caja'],
  ['reportes', '/reportes'],
  ['admin-catalogo', '/administracion/catalogo'],
  ['admin-usuarios', '/administracion/usuarios'],
  ['ajustes-identidad', '/administracion/ajustes?panel=identidad'],
  ['ajustes-numeracion', '/administracion/ajustes?panel=numeracion'],
  ['ajustes-impuestos', '/administracion/ajustes?panel=impuestos'],
  ['ajustes-reglas', '/administracion/ajustes?panel=reglas'],
  ['ajustes-impresion', '/administracion/ajustes?panel=impresion'],
  ['mantenimiento', '/administracion/mantenimiento'],
  ['ayuda', '/administracion/ayuda'],
];

const roles = ['admin.validacion', 'supervisor.validacion', 'cajero.validacion'];
const tecnicos = /(#\d+\b|\b\d{4}-\d{2}-\d{2}\b|undefined|NaN|\bnull\b|SQLSTATE|HTTP \d{3}|Exception|\(principal\)|Sesion #)/;
const informe = [];

const browser = await chromium.launch();
for (const usuario of roles) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-HN' });
  const page = await context.newPage();
  const consola = [];
  const fallos = [];
  page.on('console', (m) => { if (m.type() === 'error') consola.push(m.text()); });
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) fallos.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });

  await page.goto(`${base}/login`);
  await page.locator('input[type="password"]').waitFor({ timeout: 60000 });
  await page.locator('input:not([type="password"])').first().fill(usuario);
  await page.locator('input[type="password"]').fill(password);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });

  for (const [nombre, ruta] of rutas) {
    consola.length = 0; fallos.length = 0;
    await page.goto(`${base}${ruta}`);
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const texto = await page.locator('main').innerText().catch(() => '');
    const cargando = /Cargando|Consultando|Verificando|Actualizando/.test(texto);
    const tecnico = (texto.match(new RegExp(tecnicos, 'g')) ?? []).slice(0, 5);
    const archivo = `${usuario.split('.')[0]}-${nombre}.png`;
    await page.screenshot({ path: join(out, archivo), fullPage: false });
    informe.push({ usuario, pantalla: nombre, url: page.url().replace(base, ''), cargando, tecnico, errores_consola: [...consola], api_fallidas: [...fallos], captura: archivo, h1: (await page.locator('h1').first().innerText().catch(() => '')).trim() });
  }
  await context.close();
}
await browser.close();
writeFileSync(join(out, 'informe.json'), JSON.stringify(informe, null, 2));
for (const r of informe) {
  const marca = r.api_fallidas.length || r.errores_consola.length || r.tecnico.length || r.cargando ? 'REVISAR' : 'ok';
  console.log(`${marca.padEnd(7)} ${r.usuario.padEnd(22)} ${r.pantalla.padEnd(20)} ${r.url.padEnd(42)} h1="${r.h1}" ${r.tecnico.length ? 'tec=' + r.tecnico.join('|') : ''} ${r.api_fallidas.join(', ')} ${r.errores_consola.slice(0, 2).join(' / ').slice(0, 160)}`);
}
