import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Tasas y aviso del catálogo en una sola consulta.
 *
 * `GET /api/tax-rates` devuelve `{data, meta}`: `meta.catalog_tax_review_required`
 * es la fuente autorizada del aviso «Revise impuestos del catálogo antes de
 * cobrar». Si una versión del servidor aún no lo envía (`meta = null`), la
 * pantalla deduce el aviso con los datos cargados (ver `catalogTax.ts`).
 */
export const TAX_RATES_QUERY_KEY = ['catalog', 'tax-rates'] as const;

export function useCatalogTaxData(enabled = true) {
  return useQuery({
    queryKey: TAX_RATES_QUERY_KEY,
    queryFn: () => apiClient.getTaxRatesWithStatus(),
    staleTime: 60_000,
    retry: 0,
    enabled,
  });
}
