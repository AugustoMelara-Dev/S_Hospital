import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { StatGrid } from '@/components/shared';
import { type AuthUser, type Category, type Service, type ServiceFilters, apiClient, userSafeErrorMessage } from '../../lib/api';
import { useAreas, useCategories } from '@/hooks/useCategories';
import { useOperationalSettings } from '@/hooks/useFiscalSettings';
import { useServices } from '@/hooks/useServices';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
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
  const [lastServicesData, setLastServicesData] = useState<Awaited<ReturnType<typeof apiClient.getServicesPage>> | null>(null);
  const queryClient = useQueryClient();

  const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [serviceToDeactivate, setServiceToDeactivate] = useState<Service | null>(null);

  const canManageCatalog = useMemo(
    () => user.permissions.includes('catalog.manage'),
    [user.permissions],
  );

  const serviceFilters = useMemo<ServiceFilters>(() => ({
    search: debouncedSearch,
    categoryId: categoryFilter !== CATEGORY_FILTER_ALL ? Number(categoryFilter) : undefined,
    active: activeFilter !== STATUS_FILTER_ALL ? activeFilter === STATUS_FILTER_ACTIVE : undefined,
    page,
    perPage,
  }), [activeFilter, categoryFilter, debouncedSearch, page, perPage]);

  const servicesQuery = useServices(serviceFilters);
  const categoriesQuery = useCategories();
  const areasQuery = useAreas(true);
  const operationalSettingsQuery = useOperationalSettings();

  useEffect(() => {
    if (servicesQuery.data) {
      setLastServicesData(servicesQuery.data);
    }
  }, [servicesQuery.data]);

  const servicesData = servicesQuery.data ?? lastServicesData;
  const categories = categoriesQuery.data ?? [];
  const areas = areasQuery.data ?? [];
  const services = servicesData?.data ?? [];
  const meta = servicesData?.meta ?? { current_page: 1, per_page: DEFAULT_PER_PAGE, total: 0 };
  const scannerEnabled = operationalSettingsQuery.data?.scanner_enabled === true;
  const loadError = errorMessageFromQueries(servicesQuery.error, categoriesQuery.error, areasQuery.error);
  const isLoading = servicesQuery.isLoading && !servicesData;

  const hasFilters = search !== '' || categoryFilter !== CATEGORY_FILTER_ALL || activeFilter !== STATUS_FILTER_ALL;
  const isEmpty = services.length === 0 && !isLoading;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, CATALOG_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (loadError) {
      onStatus(loadError);
    }
  }, [loadError, onStatus]);

  const refetchCatalogData = useCallback(async () => {
    await Promise.all([
      servicesQuery.refetch(),
      categoriesQuery.refetch(),
      areasQuery.refetch(),
      operationalSettingsQuery.refetch(),
    ]);
  }, [areasQuery, categoriesQuery, operationalSettingsQuery, servicesQuery]);

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
    void refetchCatalogData();
    onStatus('Servicio guardado exitosamente.');
  }

  function handleCategorySuccess() {
    void invalidateCatalogQueries(queryClient);
    void refetchCatalogData();
    onStatus('Categoría guardada exitosamente.');
  }

  const toggleServiceActive = useCallback(
    async (service: Service) => {
      if (service.active) {
        setServiceToDeactivate(service);
        return;
      }

      try {
        await apiClient.saveService(serviceStatusPayload(service, !service.active), service.id);
        void invalidateCatalogQueries(queryClient);
        void refetchCatalogData();
        onStatus(service.active ? 'Servicio desactivado.' : 'Servicio activado.');
      } catch {
        onStatus('No se pudo cambiar el estado del servicio.');
      }
    },
    [onStatus, queryClient, refetchCatalogData],
  );

  const confirmServiceDeactivation = useCallback(async () => {
    const service = serviceToDeactivate;

    if (!service) {
      return;
    }

    try {
      await apiClient.saveService(serviceStatusPayload(service, false), service.id);
      setServiceToDeactivate(null);
      void invalidateCatalogQueries(queryClient);
      void refetchCatalogData();
      onStatus('Servicio desactivado.');
    } catch {
      onStatus('No se pudo cambiar el estado del servicio.');
    }
  }, [onStatus, queryClient, refetchCatalogData, serviceToDeactivate]);

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

      <StatGrid
        className="sm:grid-cols-2 xl:grid-cols-2"
        items={[
          {
            label: 'Total catálogo',
            value: meta.total,
            helper: `${services.length} visibles en esta página`,
            tone: meta.total > 0 ? 'success' : 'warning',
          },
          {
            label: 'Categorías',
            value: categories.length,
            helper: 'Disponibles para filtrar servicios',
            tone: categories.length > 0 ? 'info' : 'warning',
          },
        ]}
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
        onRetry={refetchCatalogData}
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

          <ConfirmDialog
            danger
            confirmLabel="Desactivar servicio"
            onCancel={() => setServiceToDeactivate(null)}
            onConfirm={() => void confirmServiceDeactivation()}
            open={serviceToDeactivate !== null}
            title="Desactivar servicio"
          >
            El servicio {serviceToDeactivate?.name ?? ''} quedara oculto para nuevos cobros. Las facturas historicas conservaran sus snapshots.
          </ConfirmDialog>
        </>
      ) : null}
    </section>
  );
}

function serviceStatusPayload(service: Service, active: boolean) {
  return {
    category_id: service.category_id,
    area_id: service.area_id ?? undefined,
    name: service.name,
    aliases: service.aliases ?? null,
    price: service.price,
    scan_code: service.scan_code ?? null,
    barcode: service.barcode ?? null,
    qr_code: service.qr_code ?? null,
    taxable: service.taxable,
    active,
    visible_in_billing: service.visible_in_billing ?? true,
    is_billable: service.is_billable ?? true,
    special_rule_code: service.special_rule_code,
  };
}

function errorMessageFromQueries(...errors: unknown[]): string {
  const firstError = errors.find(Boolean);
  return firstError ? userSafeErrorMessage(firstError, 'No se pudo cargar el catálogo.') : '';
}
