/**
 * Reproduccion minima de la cadena de formateo/parseo del commit
 * baa41f97310a578f8fd417a1e9b4b5d06c380670 de AugustoMelara-Dev/S_Hospital.
 * Cuerpos de las funciones relevantes transcritos de los archivos leidos
 * mediante GitHub; se eliminaron anotaciones TypeScript, no la logica.
 * NO es una ejecucion del frontend C1, ni una prueba de su base de datos.
 */
import assert from 'node:assert/strict';

// frontend/src/lib/money.ts
function finiteNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function formatLempirasUI(value, fractionDigits = 2) {
  const num = finiteNumber(value);
  const formatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  if (num < 0) return `- L ${formatted}`;
  return `L ${formatted}`;
}
// frontend/src/lib/moneyCents.ts
const CENTS_REGEX = /^\d+(\.\d{1,2})?$/;
function parseCents(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100);
  }
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!CENTS_REGEX.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}
function formatCents(cents) {
  if (cents === null || cents === undefined) return '0.00';
  const safe = Math.trunc(cents);
  return formatLempirasUI(safe / 100).replace(/^L\s*/, '');
}
function formatLempirasUIFromCents(cents) {
  if (cents === null || cents === undefined) return 'L 0.00';
  return formatLempirasUI(Math.trunc(cents) / 100);
}
// InvoiceCart.tsx: moneyLabel(preview.total)
function moneyLabel(value) { return formatLempirasUIFromCents(parseCents(value)); }
// posMath.computeSimpleEstimate devuelve total: formatCents(subtotal + tax).

const rows = [0,1,1725,89500,91000,99999,100000,102925,104650,109825,249000,1000000].map(cents => {
  const serialized = formatCents(cents);
  const parsed = parseCents(serialized);
  const visible = moneyLabel(serialized);
  return {cents,intermediate:serialized,parsed,visible,expected:formatLempirasUIFromCents(cents),correct:parsed === cents};
});
assert.equal(rows.find(r=>r.cents===99999).correct,true);
assert.equal(rows.find(r=>r.cents===100000).correct,false);
assert.equal(rows.find(r=>r.cents===102925).intermediate,'1,029.25');
assert.equal(rows.find(r=>r.cents===102925).parsed,null);
assert.equal(rows.find(r=>r.cents===102925).visible,'L 0.00');
console.log(JSON.stringify({source_revision:'baa41f97310a578f8fd417a1e9b4b5d06c380670',scope:'fragmentos de main, NO C1',rows},null,2));

// Demostracion de la separacion que debe integrarse, NO cambio global del formatter.
function decimalDataFromCents(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new TypeError('Centavos no negativos y enteros seguros requeridos');
  return `${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}`;
}
for (const row of rows) {
  const data=decimalDataFromCents(row.cents);
  assert.equal(parseCents(data),row.cents);
  assert.equal(moneyLabel(data),row.expected);
}
for (const v of [NaN,Infinity,null,undefined,1.5,-1,Number.MAX_SAFE_INTEGER+1]) {
  assert.throws(()=>decimalDataFromCents(v));
}
assert.equal(parseCents('1,029.25'),null); // no se vuelve permisivo el contrato de datos
console.log(`REPRODUCIDO: defecto al cruzar 1000. Separacion dato/presentacion: ${rows.length} casos validos y 7 rechazos pasan en esta demostracion aislada.`);
