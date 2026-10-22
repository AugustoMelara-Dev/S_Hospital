import type { Service, TaxRate } from '@/lib/api';

/**
 * Vínculo entre catálogo e impuestos (H-15).
 *
 * `services.tax_rate_id` es la fuente: `null` = exento. Mientras una versión del
 * backend no lo devuelva, se conserva la lectura heredada de `taxable` con la
 * tasa predeterminada, sin inventar una tasa distinta. El backend decide el
 * cálculo; estas funciones sólo presentan y precargan la selección.
 */
export type ServiceWithTaxRate = Service & { tax_rate_id?: number | null };

/** Forma mínima que necesitan las helpers: `taxable` y, si existe, `tax_rate_id`. */
export type TaxAssignableService = {
  taxable: boolean;
  tax_rate_id?: number | null;
};

export const CATALOG_TAX_REVIEW_MESSAGE = 'Revise impuestos del catálogo antes de cobrar.';

export function hasExplicitServiceTaxRate(service: TaxAssignableService): boolean {
  return Object.prototype.hasOwnProperty.call(service, 'tax_rate_id');
}

/**
 * Id de tasa vigente para un concepto:
 * - el que declare la API (incluido `null` = exento);
 * - si la API aún no lo declara, `taxable=true` cae en la tasa predeterminada;
 * - `taxable=false` es exento.
 */
export function resolveServiceTaxRateId(service: TaxAssignableService, taxRates: TaxRate[]): number | null {
  if (hasExplicitServiceTaxRate(service)) {
    const explicit = (service as ServiceWithTaxRate).tax_rate_id;
    return typeof explicit === 'number' ? explicit : null;
  }

  if (service.taxable !== true) return null;

  return taxRates.find((rate) => rate.is_default)?.id ?? null;
}

export function serviceTaxLabel(service: TaxAssignableService, taxRates: TaxRate[]): string {
  if (taxRates.length === 0 && !hasExplicitServiceTaxRate(service)) {
    return service.taxable ? 'ISV predeterminado' : 'Exento';
  }

  const taxRateId = resolveServiceTaxRateId(service, taxRates);
  if (taxRateId === null) return 'Exento';

  const rate = taxRates.find((candidate) => candidate.id === taxRateId);
  if (!rate) return 'Tasa no disponible';

  return rate.name;
}

export function isServiceTaxed(service: TaxAssignableService, taxRates: TaxRate[]): boolean {
  const taxRateId = resolveServiceTaxRateId(service, taxRates);
  if (taxRateId === null) return false;

  const rate = taxRates.find((candidate) => candidate.id === taxRateId);
  return Boolean(rate && rate.active && Number(rate.percentage) > 0);
}

/**
 * Aviso «Revise impuestos del catálogo antes de cobrar».
 *
 * Prioridad: el indicador explícito del servidor
 * (`catalog_tax_review_required`). Si aún no existe, se deduce de los datos
 * cargados: hay tasas gravables configuradas pero ningún concepto visible las
 * usa (el catálogo semilla exento). Sin tasas no se afirma nada.
 */
export function catalogTaxReviewRequired({
  flag,
  taxRates,
  services,
}: {
  flag: boolean | null;
  taxRates: TaxRate[];
  services: Service[];
}): boolean {
  if (typeof flag === 'boolean') return flag;
  if (taxRates.length === 0) return false;

  const hasTaxableRate = taxRates.some((rate) => rate.active && Number(rate.percentage) > 0);
  if (!hasTaxableRate) return true;
  if (services.length === 0) return false;

  return !services.some((service) => isServiceTaxed(service, taxRates));
}
