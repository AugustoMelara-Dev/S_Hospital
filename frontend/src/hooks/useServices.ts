import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ServiceFilters } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * 250 ms: por encima del intervalo entre pulsaciones de tecleo normal en LAN
 * (~120–200 ms), así una ráfaga completa se agrupa en una sola consulta; por
 * debajo de 300 ms para que la búsqueda no se perciba lenta. Sólo se aplica a
 * `search`: los cambios de categoría/página son discretos y se atienden al
 * instante.
 */
export const SERVICES_SEARCH_DEBOUNCE_MS = 250;

export function useServices(filters: ServiceFilters = {}, options: { enabled?: boolean } = {}) {
  const debouncedSearch = useDebouncedValue(filters.search, SERVICES_SEARCH_DEBOUNCE_MS);

  // Se conserva la identidad del objeto del llamador cuando no hay nada que
  // retrasar (montaje y término ya asentado): la primera consulta sale con los
  // filtros recibidos, sin espera añadida.
  const effectiveFilters: ServiceFilters =
    debouncedSearch === filters.search ? filters : { ...filters, search: debouncedSearch };

  const hasIntent = Boolean(
    effectiveFilters.search?.trim()
    || effectiveFilters.code?.trim()
    || effectiveFilters.categoryId
    || effectiveFilters.areaId
    || !effectiveFilters.billing,
  );

  return useQuery({
    queryKey: queryKeys.services.list(effectiveFilters),
    queryFn: ({ signal }) => apiClient.getServicesPage(effectiveFilters, { signal }),
    placeholderData: (previousData) => previousData,
    enabled: options.enabled ?? hasIntent,
  });
}
