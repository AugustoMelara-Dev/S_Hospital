import { useEffect, useRef, type Dispatch } from 'react';
import type { NewInvoiceAction, NewInvoiceState } from '../state/types';

type SearchState = Pick<NewInvoiceState, 'search' | 'selectedAreaId' | 'selectedCategoryId'>;

type PointOfSaleServiceSearchOptions = {
  canViewCatalog: boolean;
  dispatch: Dispatch<NewInvoiceAction>;
  pointOfSaleDataLoadedRef: { current: boolean };
  serviceSearchAbortRef: { current: AbortController | null };
  searchServices: (signal: AbortSignal) => Promise<void>;
  searchState: SearchState;
};

export function usePointOfSaleServiceSearch({
  canViewCatalog,
  dispatch,
  pointOfSaleDataLoadedRef,
  serviceSearchAbortRef,
  searchServices,
  searchState,
}: PointOfSaleServiceSearchOptions) {
  const searchServicesRef = useRef(searchServices);
  searchServicesRef.current = searchServices;

  useEffect(() => {
    if (!canViewCatalog || !pointOfSaleDataLoadedRef.current) return;

    const hasSearchIntent = Boolean(
      searchState.search.trim()
      || (searchState.selectedAreaId && searchState.selectedAreaId !== 'all')
      || (searchState.selectedCategoryId && searchState.selectedCategoryId !== 'all'),
    );

    if (!hasSearchIntent) {
      serviceSearchAbortRef.current?.abort();
      serviceSearchAbortRef.current = null;
      dispatch({ type: 'SEARCH_SERVICES_SUCCESS', payload: [] });
      dispatch({ type: 'SET_LOADING_SERVICES', payload: false });
      return;
    }

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
    pointOfSaleDataLoadedRef,
    searchState.search,
    searchState.selectedAreaId,
    searchState.selectedCategoryId,
    serviceSearchAbortRef,
  ]);
}
