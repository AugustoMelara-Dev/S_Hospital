import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Collapse, Input, Modal, Typography } from 'antd';
import { type AuthUser, type Category, type Service, type ServiceFilters, apiClient, userSafeErrorMessage } from '../../lib/api';
import { useAreas, useCategories } from '@/hooks/useCategories';
import { useOperationalSettings } from '@/hooks/useFiscalSettings';
import { useServices } from '@/hooks/useServices';
import { CatalogPagination } from './components/CatalogPagination';
import { CatalogToolbar } from './components/CatalogToolbar';
import { ServiceCatalogTable } from './components/ServiceCatalogTable';
import { CategoryDrawer } from './components/CategoryDrawer';
import { ServiceDrawer } from './components/ServiceDrawer';
import { invalidateCatalogQueries } from '@/lib/queryInvalidation';
import { PageHeader } from '@/design-system/components/PageHeader';
import {
  CATALOG_DEBOUNCE_MS,
  CATEGORY_FILTER_ALL,
  STATUS_FILTER_ACTIVE,
  STATUS_FILTER_ALL,
} from './components/catalogTypes';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

type CatalogViewProps = {
  user: AuthUser;
  onStatus: OperationalStatusReporter;
};

const DEFAULT_PER_PAGE = 15;

export function CatalogView({ user, onStatus }: CatalogViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  const setSearchParamsRef = useRef(setSearchParams);
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('q') ?? '');
  const [categoryFilter, setCategoryFilter] = useState<string>(() => searchParams.get('category') ?? CATEGORY_FILTER_ALL);
  const [activeFilter, setActiveFilter] = useState<string>(() => searchParams.get('status') ?? STATUS_FILTER_ALL);
  const [page, setPage] = useState(() => positiveUrlInteger(searchParams.get('page'), 1));
  const [perPage, setPerPage] = useState(() => positiveUrlInteger(searchParams.get('per_page'), DEFAULT_PER_PAGE));
  const [lastServicesData, setLastServicesData] = useState<Awaited<ReturnType<typeof apiClient.getServicesPage>> | null>(null);
  const queryClient = useQueryClient();

  const [servicePendingStatusChange, setServicePendingStatusChange] = useState<Service | null>(null);

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
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const areas = areasQuery.data ?? [];
  const services = useMemo(() => servicesData?.data ?? [], [servicesData]);
  const overlayState = catalogOverlayState(searchParams, services, categories);
  const meta = servicesData?.meta ?? { current_page: 1, per_page: DEFAULT_PER_PAGE, total: 0 };
  const scannerEnabled = operationalSettingsQuery.data?.scanner_enabled === true;
  const serviceStatusActionLabel = servicePendingStatusChange?.active ? 'Desactivar servicio' : 'Activar servicio';
  const loadError = errorMessageFromQueries(servicesQuery.error, categoriesQuery.error, areasQuery.error);
  const isLoading = servicesQuery.isLoading && !servicesData;

  const hasFilters = search !== '' || categoryFilter !== CATEGORY_FILTER_ALL || activeFilter !== STATUS_FILTER_ALL;
  const isEmpty = services.length === 0 && !isLoading;

  useEffect(() => {
    searchParamsRef.current = searchParams;
    setSearchParamsRef.current = setSearchParams;
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
      const trimmedSearch = search.trim();
      const currentParams = searchParamsRef.current;
      if ((currentParams.get('q') ?? '') === trimmedSearch && !currentParams.has('page')) {
        return;
      }

      const next = new URLSearchParams(currentParams);
      setOrDelete(next, 'q', trimmedSearch);
      next.delete('page');
      searchParamsRef.current = next;

      setSearchParamsRef.current(next, { replace: true });
    }, CATALOG_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    const nextSearch = searchParams.get('q') ?? '';
    const nextCategory = searchParams.get('category') ?? CATEGORY_FILTER_ALL;
    const nextStatus = searchParams.get('status') ?? STATUS_FILTER_ALL;
    const nextPage = positiveUrlInteger(searchParams.get('page'), 1);
    const nextPerPage = positiveUrlInteger(searchParams.get('per_page'), DEFAULT_PER_PAGE);

    setSearch((current) => current === nextSearch ? current : nextSearch);
    setDebouncedSearch((current) => current === nextSearch ? current : nextSearch);
    setCategoryFilter((current) => current === nextCategory ? current : nextCategory);
    setActiveFilter((current) => current === nextStatus ? current : nextStatus);
    setPage((current) => current === nextPage ? current : nextPage);
    setPerPage((current) => current === nextPerPage ? current : nextPerPage);
  }, [searchParams]);

  useEffect(() => {
    if (loadError) {
      onStatus({ key: 'catalog:load', level: 'error', message: loadError, toast: false });
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
    updateCatalogUrl({ category: value === CATEGORY_FILTER_ALL ? null : value, page: null });
  }

  function handleActiveFilterChange(value: string) {
    setActiveFilter(value);
    setPage(1);
    updateCatalogUrl({ status: value === STATUS_FILTER_ALL ? null : value, page: null });
  }

  function handlePerPageChange(value: number) {
    setPerPage(value);
    setPage(1);
    updateCatalogUrl({ per_page: value === DEFAULT_PER_PAGE ? null : String(value), page: null });
  }

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setCategoryFilter(CATEGORY_FILTER_ALL);
    setActiveFilter(STATUS_FILTER_ALL);
    setPage(1);
    const next = new URLSearchParams(searchParamsRef.current);
    ['q', 'category', 'status', 'page', 'per_page'].forEach((key) => next.delete(key));
    searchParamsRef.current = next;

    setSearchParamsRef.current(next);
  }

  function openNewService() {
    updateCatalogUrl({ panel: 'new-service', service: null });
  }

  function openEditService(service: Service) {
    updateCatalogUrl({ service: String(service.id), panel: null });
  }

  function openNewCategory() {
    updateCatalogUrl({ panel: 'new-category', service: null, edit_category: null });
  }

  function openEditCategory(category: Category) {
    updateCatalogUrl({ edit_category: String(category.id), panel: null, service: null });
  }

  function handleServiceDrawerOpenChange(open: boolean) {
    if (!open) updateCatalogUrl({ service: null, panel: null });
  }

  function handleCategoryDrawerOpenChange(open: boolean) {
    if (!open) updateCatalogUrl({ panel: null, edit_category: null });
  }

  function updateCatalogUrl(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParamsRef.current);
    setOrDelete(next, 'q', search.trim());
    Object.entries(patch).forEach(([key, value]) => setOrDelete(next, key, value));
    searchParamsRef.current = next;

    setSearchParamsRef.current(next);
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    updateCatalogUrl({ page: nextPage > 1 ? String(nextPage) : null });
  }

  function handleServiceSuccess() {
    void invalidateCatalogQueries(queryClient);
    void refetchCatalogData();
    onStatus({ key: 'catalog:service:save', level: 'success', message: 'Servicio guardado exitosamente.' });
  }

  function handleCategorySuccess() {
    void invalidateCatalogQueries(queryClient);
    void refetchCatalogData();
    onStatus({ key: 'catalog:category:save', level: 'success', message: 'Categoría guardada exitosamente.' });
  }

  const toggleServiceActive = useCallback((service: Service) => {
    setServicePendingStatusChange(service);
  }, []);

  const confirmServiceStatusChange = useCallback(async (reason: string | null) => {
    const service = servicePendingStatusChange;

    if (!service) {
      return;
    }

    const nextActive = !service.active;

    try {
      await apiClient.saveService(serviceStatusPayload(service, nextActive, reason), service.id);
      setServicePendingStatusChange(null);
      void invalidateCatalogQueries(queryClient);
      void refetchCatalogData();
      onStatus({ key: 'catalog:service:status', level: 'success', message: nextActive ? 'Servicio activado.' : 'Servicio desactivado.' });
    } catch {
      onStatus({ key: 'catalog:service:status', level: 'error', message: 'No se pudo cambiar el estado del servicio.' });
    }
  }, [onStatus, queryClient, refetchCatalogData, servicePendingStatusChange]);

  function normalizeServiceForDrawer(service: Service) {
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
      className="flex flex-col gap-4"
      aria-label="Catálogo institucional"
    >
      <PageHeader
        eyebrow="Servicios y productos facturables"
        title="Catálogo institucional"
        description={canManageCatalog
          ? 'Administre categorías, servicios y precios para mantener operativo el catálogo de caja.'
          : 'Consulte el catálogo y sus precios vigentes sin modificar servicios.'}
        actions={canManageCatalog ? (
          <>
            <Button onClick={openNewCategory} aria-label="Crear nueva categoría" icon={<PlusOutlined />}>Nueva categoría</Button>
            <Button type="primary" onClick={openNewService} aria-label="Crear nuevo servicio" icon={<PlusOutlined />}>Nuevo servicio</Button>
          </>
        ) : undefined}
      />
      <Typography.Text role="status" aria-label="Resumen de servicios en el catálogo">
        {meta.total} servicio{meta.total !== 1 ? 's' : ''} en el catálogo
      </Typography.Text>
      {!canManageCatalog ? (
        <Alert type="info" title="Solo lectura" description="Esta cuenta puede consultar el catálogo, pero no modificar servicios ni categorías." />
      ) : null}

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
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
        />
      ) : null}

      {canManageCatalog && categories.length > 0 ? (
        <Collapse
          className="border-y border-border bg-surface"
          destroyOnHidden
          expandIconPlacement="end"
          size="small"
          items={[{
            key: 'editable-categories',
            label: (
              <div>
                <h2 className="text-sm font-semibold text-foreground">Categorías del catálogo</h2>
                <p className="text-xs text-muted-foreground">{categories.length} disponibles · abrir para editar</p>
              </div>
            ),
            children: (
              <ul className="flex flex-wrap gap-2" aria-label="Categorías editables">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Button
                      htmlType="button"
                      size="small"
                      aria-label={`Editar categoría ${category.name}`}
                      onClick={() => openEditCategory(category)}
                    >
                      <EditOutlined aria-hidden="true" />
                      {category.name}
                    </Button>
                  </li>
                ))}
              </ul>
            ),
          }]}
        />
      ) : null}

      {canManageCatalog ? (
        <>
          <ServiceDrawer
            open={overlayState.serviceDrawerOpen}
            onOpenChange={handleServiceDrawerOpenChange}
            service={overlayState.editingService ? normalizeServiceForDrawer(overlayState.editingService) : null}
            categories={categories}
            areas={areas}
            scannerEnabled={scannerEnabled}
            onSuccess={handleServiceSuccess}
          />

          <CategoryDrawer
            open={overlayState.categoryDrawerOpen}
            onOpenChange={handleCategoryDrawerOpenChange}
            category={overlayState.editingCategory}
            onSuccess={handleCategorySuccess}
          />

          <ConfirmDialog
            danger={servicePendingStatusChange?.active === true}
            confirmLabel={serviceStatusActionLabel}
            onCancel={() => setServicePendingStatusChange(null)}
            onConfirm={(reason) => void confirmServiceStatusChange(reason)}
            open={servicePendingStatusChange !== null}
            reasonHelpText="Minimo 5 caracteres. El motivo quedara registrado en auditoria del catalogo."
            requireReasonMinLength={5}
            requireReasonTextarea
            title={serviceStatusActionLabel}
          >
            {servicePendingStatusChange?.active
              ? `El servicio ${servicePendingStatusChange.name} quedara oculto para nuevos cobros. Las facturas historicas conservaran sus snapshots.`
              : `El servicio ${servicePendingStatusChange?.name ?? ''} volvera a estar disponible para nuevos cobros. Las facturas historicas conservaran sus snapshots.`}
          </ConfirmDialog>
        </>
      ) : null}
    </section>
  );
}

export function catalogOverlayState(
  searchParams: URLSearchParams,
  services: Service[],
  categories: Category[],
) {
  const requestedServiceId = positiveUrlInteger(searchParams.get('service'), 0);
  const requestedCategoryId = positiveUrlInteger(searchParams.get('edit_category'), 0);
  const requestedPanel = searchParams.get('panel');
  const editingService = requestedServiceId
    ? services.find((candidate) => candidate.id === requestedServiceId) ?? null
    : null;
  const editingCategory = requestedCategoryId
    ? categories.find((candidate) => candidate.id === requestedCategoryId) ?? null
    : null;

  return {
    editingCategory,
    editingService,
    categoryDrawerOpen: requestedPanel === 'new-category' || editingCategory !== null,
    serviceDrawerOpen: requestedPanel === 'new-service' || editingService !== null,
  };
}

export function serviceStatusPayload(service: Service, active: boolean, availabilityChangeReason?: string | null) {
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
    availability_change_reason: availabilityChangeReason?.trim() || undefined,
    special_rule_code: service.special_rule_code,
  };
}

function errorMessageFromQueries(...errors: unknown[]): string {
  const firstError = errors.find(Boolean);
  return firstError ? userSafeErrorMessage(firstError, 'No se pudo cargar el catálogo.') : '';
}

function positiveUrlInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function setOrDelete(params: URLSearchParams, key: string, value: string | null) {
  if (value) params.set(key, value);
  else params.delete(key);
}

export function ConfirmDialog({ open, title, children, confirmLabel, danger, onCancel, onConfirm, reasonHelpText, requireReasonMinLength = 0 }: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
  reasonHelpText?: string;
  requireReasonMinLength?: number;
  requireReasonTextarea?: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      title={title}
      okText={confirmLabel}
      okButtonProps={{ danger, disabled: reason.trim().length < requireReasonMinLength }}
      onCancel={() => { setReason(''); onCancel(); }}
      onOk={() => { onConfirm(reason.trim() || null); setReason(''); }}
    >
      <Typography.Paragraph>{children}</Typography.Paragraph>
      <label htmlFor="catalog-audit-reason">Motivo de auditoría</label>
      <Input.TextArea id="catalog-audit-reason" value={reason} onChange={(event) => setReason(event.target.value)} aria-describedby="catalog-audit-help" />
      <Typography.Text id="catalog-audit-help" type="secondary">{reasonHelpText}</Typography.Text>
    </Modal>
  );
}
