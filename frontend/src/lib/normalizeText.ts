/**
 * Normalización única para filtros locales de la interfaz.
 *
 * El sistema hospitalario recibe nombres, categorías y notas escritas por
 * personas: "González", "Categoría", "HÉMATOLOGÍA". Los filtros locales
 * (POS ya cargado, usuarios, movimientos de caja, ayuda) deben encontrar
 * esas coincidencias aunque el operador escriba sin acentos o en otra caja.
 *
 * Regla: plegar acentos, recortar extremos y pasar a minúsculas. No se
 * eliminan espacios internos ni signos: los filtros comparan con `includes`
 * sobre el texto normalizado.
 */
export function normalizeSearchText(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}
