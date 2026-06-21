import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type Area, type AuthUser, type Category, type Service, apiClient, userSafeErrorMessage } from '../../lib/api';
import { CatalogPagination } from './components/CatalogPagination';
import { CatalogToolbar } from './components/CatalogToolbar';
import { ServiceCatalogTable } from './components/ServiceCatalogTable';
import { ServiceStatusSummary } from './components/ServiceStatusSummary';
import { CategorySheet } from './components/CategorySheet';
import { ServiceSheet } from './components/ServiceSheet';
import { invalidateCatalogQueries } from '@/lib/queryInvalidation';
import {
  CATALOG_DEBOUNCE_MS,
  CATEGORY_FILTER_ALL,
  STATUS_FILTER_ACTIVE,
  STATUS_FILTER_ALL,
} from './components/catalogTypes';

type CatalogViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

const DEFAULT_PER_PAGE = 15;

export function CatalogView({ user, onStatus }: CatalogViewProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(CATEGORY_FILTER_ALL);
  const [activeFilter, setActiveFilter] = useState<string>(STATUS_FILTER_ALL);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [servicesData, setServicesData] = useState<Awaited<ReturnType<typeof apiClient.getServicesPage>> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const queryClient = useQueryClient();

  const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const canManageCatalog = useMemo(
    () => user.permissions.includes('catalog.manage'),
    [user.permissions],
  );

  const services = servicesData?.data ?? [];
  const meta = servicesData?.meta ?? { current_page: 1, per_page: DEFAULT_PER_PAGE, total: 0 };

  const hasFilters = search !== '' || categoryFilter !== CATEGORY_FILTER_ALL || activeFilter !== STATUS_FILTER_ALL;
  const isEmpty = services.length === 0 && !isLoading;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, CATALOG_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const loadCatalogData = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [nextCategories, nextAreas, nextServices, operationalSettings] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getAreas(true),
        apiClient.getServicesPage({
          search: debouncedSearch,
          categoryId: categoryFilter !== CATEGORY_FILTER_ALL ? Number(categoryFilter) : undefined,
          active: activeFilter !== STATUS_FILTER_ALL ? activeFilter === STATUS_FILTER_ACTIVE : undefined,
          page,
          perPage,
        }),
        apiClient.getOperationalSettings().catch(() => null),
      ]);
      setCategories(nextCategories);
      setAreas(nextAreas);
      setServicesData(nextServices);
      setScannerEnabled(operationalSettings?.scanner_enabled === true);
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo cargar el catálogo.');
      setLoadError(message);
      onStatus(message);
      setCategories([]);
      setAreas([]);
      setServicesData(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, categoryFilter, debouncedSearch, onStatus, page, perPage]);

  useEffect(() => {
    void loadCatalogData();
  }, [loadCatalogData]);

  function handleCategoryFilterChange(value: string) {
    setCategoryFilter(value);
    setPage(1);
  }

  function handleActiveFilterChange(value: string) {
    setActiveFilter(value);
    setPage(1);
  }

  function handlePerPageChange(value: number) {
    setPerPage(value);
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setCategoryFilter(CATEGORY_FILTER_ALL);
    setActiveFilter(STATUS_FILTER_ALL);
    setPage(1);
  }

  function openNewService() {
    setEditingService(null);
    setServiceSheetOpen(true);
  }

  function openEditService(service: Service) {
    setEditingService(service);
    setServiceSheetOpen(true);
  }

  function openNewCategory() {
    setEditingCategory(null);
    setCategorySheetOpen(true);
  }

  function handleServiceSuccess() {
    void invalidateCatalogQueries(queryClient);
    void loadCatalogData();
    onStatus('Servicio guardado exitosamente.');
  }

  function handleCategorySuccess() {
    void invalidateCatalogQueries(queryClient);
    void loadCatalogData();
    onStatus('Categoría guardada exitosamente.');
  }

  const toggleServiceActive = useCallback(
    async (service: Service) => {
      try {
        await apiClient.saveService(
          {
            category_id: service.category_id,
            area_id: service.area_id ?? undefined,
            name: service.name,
            price: service.price,
            scan_code: service.scan_code ?? null,
            barcode: service.barcode ?? null,
            qr_code: service.qr_code ?? null,
            taxable: service.taxable,
            active: !service.active,
            visible_in_billing: service.visible_in_billing ?? true,
            is_billable: service.is_billable ?? true,
            special_rule_code: service.special_rule_code,
          },
          service.id,
        );
        void invalidateCatalogQueries(queryClient);
        void loadCatalogData();
        onStatus(service.active ? 'Servicio desactivado.' : 'Servicio activado.');
      } catch {
        onStatus('No se pudo cambiar el estado del servicio.');
      }
    },
    [loadCatalogData, onStatus, queryClient],
  );

  function normalizeServiceForSheet(service: Service) {
    return {
      ...service,
      scan_code: service.scan_code ?? null,
      barcode: service.barcode ?? null,
      qr_code: service.qr_code ?? null,
      visible_in_billing: service.visible_in_billing ?? true,
      is_billable: service.is_billable ?? true,
      special_rule_code: service.special_rule_code ?? null,
    };
  }

  return (
    <section
      id="catalogo"
      className="flex flex-col gap-6"
      aria-labelledby="catalog-title"
    >
      <ServiceStatusSummary
        canManage={canManageCatalog}
        onNewCategory={openNewCategory}
        onNewService={openNewService}
        summary={{ count: services.length, total: meta.total }}
      />

      <CatalogToolbar
        categories={categories}
        categoryFilter={categoryFilter}
        hasActiveFilters={hasFilters}
        isLoading={isLoading}
        onActiveFilterChange={handleActiveFilterChange}
        onCategoryFilterChange={handleCategoryFilterChange}
        onClearFilters={clearFilters}
        onSearchChange={setSearch}
        searchValue={search}
        statusFilter={activeFilter}
      />

      <ServiceCatalogTable
        canManage={canManageCatalog}
        isLoading={isLoading}
        loadError={loadError}
        onClearFilters={clearFilters}
        onRetry={loadCatalogData}
        onRowActions={{ canManage: canManageCatalog, onEdit: openEditService, onToggleActive: toggleServiceActive }}
        scannerEnabled={scannerEnabled}
        services={services}
        hasActiveFilters={hasFilters}
        isEmpty={isEmpty}
        categories={categories}
        areas={areas}
      />

      {!isEmpty ? (
        <CatalogPagination
          isLoading={isLoading}
          meta={meta}
          perPage={perPage}
          servicesCount={services.length}
          onPageChange={setPage}
          onPerPageChange={handlePerPageChange}
        />
      ) : null}

      {canManageCatalog ? (
        <>
          <ServiceSheet
            open={serviceSheetOpen}
            onOpenChange={setServiceSheetOpen}
            service={editingService ? normalizeServiceForSheet(editingService) : null}
            categories={categories}
            areas={areas}
            scannerEnabled={scannerEnabled}
            onSuccess={handleServiceSuccess}
          />

          <CategorySheet
            open={categorySheetOpen}
            onOpenChange={setCategorySheetOpen}
            category={editingCategory}
            onSuccess={handleCategorySuccess}
          />
        </>
      ) : null}
    </section>
  );
}
