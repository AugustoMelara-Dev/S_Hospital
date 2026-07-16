import { useEffect, useRef, type Dispatch } from 'react';
import type { NewInvoiceAction, NewInvoiceState } from '../state/types';

type SearchState = Pick<
  NewInvoiceState,
  'search' | 'selectedAreaId' | 'selectedCategoryId' | 'loadingServices' | 'loadingMoreServices' | 'hasMoreServices' | 'servicePage'
>;

type PointOfSaleServiceSearchOptions = {
  canViewCatalog: boolean;
  dispatch: Dispatch<NewInvoiceAction>;
  loadData: () => Promise<void>;
  pointOfSaleDataLoaded: boolean;
  pointOfSaleDataLoadedRef: { current: boolean };
  serviceSearchAbortRef: { current: AbortController | null };
  searchServices: (signal: AbortSignal, page?: number) => Promise<void>;
  searchState: SearchState;
};

export function usePointOfSaleServiceSearch({
  canViewCatalog,
  dispatch,
  loadData,
  pointOfSaleDataLoaded,
  pointOfSaleDataLoadedRef,
  serviceSearchAbortRef,
  searchServices,
  searchState,
}: PointOfSaleServiceSearchOptions) {
  const loadDataRef = useRef(loadData);
  const searchServicesRef = useRef(searchServices);
  loadDataRef.current = loadData;
  searchServicesRef.current = searchServices;

  useEffect(() => {
    if (!canViewCatalog || !pointOfSaleDataLoaded) return;

    if (!hasSearchIntent(searchState.search, searchState.selectedAreaId, searchState.selectedCategoryId)) {
      serviceSearchAbortRef.current?.abort();
      serviceSearchAbortRef.current = null;
      dispatch({ type: 'SEARCH_SERVICES_SUCCESS', payload: [] });
      dispatch({ type: 'SET_SERVICE_PAGE_STATE', payload: { page: 1, hasMore: false } });
      dispatch({ type: 'SET_LOADING_SERVICES', payload: false });
      return;
    }

    serviceSearchAbortRef.current?.abort();
    dispatch({ type: 'SET_LOADING_MORE_SERVICES', payload: false });
    dispatch({ type: 'SET_SERVICE_PAGE_STATE', payload: { page: 1, hasMore: false } });
    dispatch({ type: 'SET_LOADING_SERVICES', payload: true });
    const controller = new AbortController();
    serviceSearchAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => {
      void searchServicesRef.current(controller.signal);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
      if (serviceSearchAbortRef.current === controller) serviceSearchAbortRef.current = null;
    };
  }, [
    canViewCatalog,
    dispatch,
    pointOfSaleDataLoaded,
    searchState.search,
    searchState.selectedAreaId,
    searchState.selectedCategoryId,
    serviceSearchAbortRef,
  ]);

  async function retryLoad() {
    if (!pointOfSaleDataLoadedRef.current) await loadDataRef.current();
    if (!pointOfSaleDataLoadedRef.current || !hasSearchIntent(
      searchState.search,
      searchState.selectedAreaId,
      searchState.selectedCategoryId,
    )) return;

    serviceSearchAbortRef.current?.abort();
    const controller = new AbortController();
    serviceSearchAbortRef.current = controller;
    try {
      await searchServicesRef.current(controller.signal);
    } finally {
      if (serviceSearchAbortRef.current === controller) serviceSearchAbortRef.current = null;
    }
  }

  async function loadMoreServices() {
    if (searchState.loadingServices || searchState.loadingMoreServices || !searchState.hasMoreServices) return;

    serviceSearchAbortRef.current?.abort();
    const controller = new AbortController();
    serviceSearchAbortRef.current = controller;
    try {
      await searchServicesRef.current(controller.signal, searchState.servicePage + 1);
    } finally {
      if (serviceSearchAbortRef.current === controller) serviceSearchAbortRef.current = null;
    }
  }

  return { loadMoreServices, retryLoad };
}

function hasSearchIntent(
  search: string,
  selectedAreaId: NewInvoiceState['selectedAreaId'],
  selectedCategoryId: NewInvoiceState['selectedCategoryId'],
): boolean {
  return Boolean(
    search.trim()
    || (selectedAreaId && selectedAreaId !== 'all')
    || (selectedCategoryId && selectedCategoryId !== 'all'),
  );
}
