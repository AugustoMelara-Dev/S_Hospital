import { useCallback, useEffect, type Dispatch, type RefObject } from 'react';
import { apiClient, type CashSession, type FiscalSettings, userSafeErrorMessage } from '../../../lib/api';
import { useFiscalSettings } from '../../../hooks/useFiscalSettings';
import { institutionalReceiptPaperSize } from '../../../lib/institutionalReceiptPaper';
import type { NewInvoiceAction, NewInvoiceState } from '../state/types';

const POS_SERVICE_PAGE_SIZE = 24;

export type UsePosDataLoaderArgs = {
  state: NewInvoiceState;
  dispatch: Dispatch<NewInvoiceAction>;
  canViewCatalog: boolean;
  cashSession: CashSession | null;
  onCashSessionChange?: (session: CashSession | null) => void;
  onStatus: (message: string) => void;
  patientInputRef: RefObject<HTMLInputElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  initialPatientNameRef: RefObject<string>;
};

export type UsePosDataLoaderResult = {
  fiscalSettings: FiscalSettings | null | undefined;
  loadPointOfSaleData: () => Promise<void>;
  searchPointOfSaleServices: () => Promise<void>;
};

export function usePosDataLoader({
  state,
  dispatch,
  canViewCatalog,
  cashSession,
  onCashSessionChange,
  onStatus,
  patientInputRef,
  searchInputRef,
  initialPatientNameRef,
}: UsePosDataLoaderArgs): UsePosDataLoaderResult {
  const { data: fiscalSettings } = useFiscalSettings();

  const loadPointOfSaleData = useCallback(async () => {
    if (!canViewCatalog) {
      dispatch({ type: 'SET_ALERT_MESSAGE', payload: 'Este usuario no tiene permiso para consultar el catálogo de servicios.' });
      dispatch({ type: 'SET_LOADING_SERVICES', payload: false });
      return;
    }
    dispatch({ type: 'SET_LOADING_SERVICES', payload: true });
    try {
      const [currentCashSession, nextAreas, nextCategories, nextServices] = await Promise.all([
        apiClient.getCurrentCashSession(),
        apiClient.getAreas(true),
        apiClient.getCategories(true),
        apiClient.getServices({ active: true, billing: true, perPage: POS_SERVICE_PAGE_SIZE }),
      ]);
      dispatch({
        type: 'LOAD_DATA_SUCCESS',
        payload: {
          loadedCashSession: currentCashSession,
          areas: Array.isArray(nextAreas) ? nextAreas : [],
          categories: Array.isArray(nextCategories) ? nextCategories : [],
          services: Array.isArray(nextServices) ? nextServices : [],
        },
      });
      onCashSessionChange?.(currentCashSession);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo cargar servicios activos.'));
    } finally {
      dispatch({ type: 'SET_LOADING_SERVICES', payload: false });
    }
  }, [canViewCatalog, onCashSessionChange, onStatus, dispatch]);

  const searchPointOfSaleServices = useCallback(async () => {
    dispatch({ type: 'SET_LOADING_SERVICES', payload: true });
    try {
      const nextServices = await apiClient.getServices({
        active: true,
        billing: true,
        search: state.search.trim() || undefined,
        areaId: state.selectedAreaId && state.selectedAreaId !== 'all' ? state.selectedAreaId : undefined,
        categoryId: state.selectedCategoryId && state.selectedCategoryId !== 'all' ? state.selectedCategoryId : undefined,
        perPage: POS_SERVICE_PAGE_SIZE,
      });
      dispatch({ type: 'SEARCH_SERVICES_SUCCESS', payload: Array.isArray(nextServices) ? nextServices : [] });
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo buscar servicios activos.'));
    } finally {
      dispatch({ type: 'SET_LOADING_SERVICES', payload: false });
    }
  }, [onStatus, state.search, state.selectedAreaId, state.selectedCategoryId, dispatch]);

  useEffect(() => {
    void loadPointOfSaleData();
  }, [loadPointOfSaleData]);

  useEffect(() => {
    window.setTimeout(() => {
      if (initialPatientNameRef.current.trim()) {
        searchInputRef.current?.focus();
        return;
      }
      patientInputRef.current?.focus();
    }, 0);
  }, [patientInputRef, searchInputRef, initialPatientNameRef]);

  useEffect(() => {
    if (!canViewCatalog) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void searchPointOfSaleServices();
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [canViewCatalog, searchPointOfSaleServices]);

  useEffect(() => {
    if (cashSession) {
      dispatch({ type: 'SET_LOADED_CASH_SESSION', payload: cashSession });
    }
  }, [cashSession, dispatch]);

  useEffect(() => {
    if (!fiscalSettings) {
      return;
    }
    dispatch({ type: 'SET_SCANNER_ENABLED', payload: fiscalSettings.scanner_enabled === true });
    dispatch({ type: 'SET_PARTIAL_PAYMENTS_ENABLED', payload: fiscalSettings.partial_payments_enabled === true });
    dispatch({
      type: 'SET_RECEIPT_WIDTH',
      payload: institutionalReceiptPaperSize(fiscalSettings.receipt_paper_size),
    });
  }, [fiscalSettings, dispatch]);

  return { fiscalSettings, loadPointOfSaleData, searchPointOfSaleServices };
}
