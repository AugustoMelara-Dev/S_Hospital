#!/usr/bin/env node
/**
 * Diagnóstico focalizado, sin edición: contrato de preview monetario de S_Hospital.
 * Lee y ejecuta ÚNICAMENTE los tres módulos TypeScript locales indicados abajo.
 * No accede a la base, no inicia servicios, no instala paquetes, no modifica el repo.
 * Requiere Node y TypeScript ya instalado en frontend/node_modules.
 *
 * node verificar_contrato_monetario.cjs --repo "C:\\Projects\\S_Hospital_AI"
 * Exit 0: estos casos del contrato heredado pasan. NO certifica la aplicación.
 * Exit 1: discrepancia reproducida. Exit 2: contrato/módulos distintos o herramienta ausente.
 * Tras un refactor que cambie las firmas, sustituir este diagnóstico por pruebas del
 * contrato nuevo. No conservar la API antigua únicamente para que este script pase.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {createHash} = require('node:crypto');

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--repo') {
    throw new Error('Uso: node verificar_contrato_monetario.cjs --repo "C:\\Projects\\S_Hospital_AI"');
  }
  const root = fs.realpathSync(path.resolve(args[1]));
  const frontend = path.join(root, 'frontend');
  const req = createRequire(path.join(frontend, 'package.json'));
  let ts;
  try { ts = req('typescript'); }
  catch { throw new Error('No está disponible TypeScript desde frontend. No se instalará automáticamente.'); }
  const relativeFiles = [
    'src/lib/money.ts',
    'src/lib/moneyCents.ts',
    'src/features/invoices/state/posMath.ts',
  ];
  const paths = relativeFiles.map(name => fs.realpathSync(path.join(frontend, name)));
  const allowed = new Set(paths);
  const cache = new Map();
  const hashes = [];
  function load(file) {
    const real = fs.realpathSync(file);
    if (!allowed.has(real)) throw new Error('Import no admitido por este diagnóstico: ' + real);
    if (cache.has(real)) return cache.get(real).exports;
    const source = fs.readFileSync(real, 'utf8');
    if (Buffer.byteLength(source) > 512 * 1024) throw new Error('Módulo demasiado grande para este diagnóstico: ' + real);
    hashes.push({file:path.relative(root, real).replaceAll('\\','/'), sha256:createHash('sha256').update(source).digest('hex')});
    const compiled = ts.transpileModule(source, {
      fileName:real,
      compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022},
      reportDiagnostics:true,
    });
    const errors = (compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
    if (errors.length) throw new Error('TypeScript: ' + errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; '));
    const mod = {exports:{}};
    cache.set(real,mod);
    const limitedRequire = specifier => {
      if (!specifier.startsWith('.')) throw new Error('Dependencia nueva no admitida: ' + specifier);
      let target = path.resolve(path.dirname(real),specifier);
      if (!path.extname(target)) target += '.ts';
      return load(target);
    };
    // Contexto acotado para estos módulos de cálculo; no se presenta como sandbox de seguridad.
    const context = vm.createContext({module:mod,exports:mod.exports,require:limitedRequire,console});
    new vm.Script(compiled.outputText,{filename:real}).runInContext(context,{timeout:3000});
    return mod.exports;
  }
  const money = load(paths[1]);
  const pos = load(paths[2]);
  for (const [name,fn] of Object.entries({parseCents:money.parseCents,formatLempirasUIFromCents:money.formatLempirasUIFromCents,computeSimpleEstimate:pos.computeSimpleEstimate})) {
    if (typeof fn !== 'function') throw new Error('El contrato cambió o falta la función: ' + name);
  }
  function item(id,price,quantity='1',taxable=true) {
    return {service:{id,name:'Servicio sintético '+id,price,taxable,special_rule_code:null},quantity,dialysisPrescription:false};
  }
  const cases = [
    {name:'Cero legítimo',items:[item(1,'0.00')],rate:'0.00',cents:0},
    {name:'Antes de mil',items:[item(1,'999.99')],rate:'0.00',cents:99999},
    {name:'Exactamente mil',items:[item(1,'1000.00')],rate:'0.00',cents:100000},
    {name:'Captura 6: 850 + 45, impuesto sintético 15%',items:[item(1,'850.00'),item(2,'45.00')],rate:'15.00',cents:102925},
    {name:'Capturas 3-5: 850 + 45 + 15, impuesto sintético 15%',items:[item(1,'850.00'),item(2,'45.00'),item(3,'15.00')],rate:'15.00',cents:104650},
    {name:'Cantidad dos × 850, sin impuesto',items:[item(1,'850.00','2.00')],rate:'0.00',cents:170000},
  ];
  const rows = cases.map(c => {
    const estimate = pos.computeSimpleEstimate(c.items,c.rate);
    if (!estimate || typeof estimate.total !== 'string') throw new Error('La estimación ya no tiene total:string. Actualizar el diagnóstico al contrato nuevo; no revertir el refactor.');
    const parsed = money.parseCents(estimate.total);
    const visible = money.formatLempirasUIFromCents(parsed);
    const expectedVisible = money.formatLempirasUIFromCents(c.cents);
    return {case:c.name,expected_cents:c.cents,preview:estimate,parsed_cents:parsed,visible,expected_visible:expectedVisible,status:parsed===c.cents && visible===expectedVisible?'PASS':'FAIL'};
  });
  const failures = rows.filter(r=>r.status==='FAIL').length;
  console.log(JSON.stringify({scope:'Diagnóstico local de tres módulos; no es E2E ni certificación',root,node:process.version,typescript:ts.version,source_files:hashes,cases:rows,failed:failures},null,2));
  process.exitCode = failures ? 1 : 0;
}
try { main(); }
catch (error) { console.error('DIAGNÓSTICO NO EJECUTABLE: '+error.message); process.exitCode = 2; }
