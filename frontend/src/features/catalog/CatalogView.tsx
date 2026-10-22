import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ChevronDownIcon, EditIcon, PlusIcon } from 'lucide-react';
import { AdminCallout, AdminChip, AdminDialog, AdminField, AdminPageHeader, AdminPanel, StatusStamp } from '@/design-system/admin/components';
import { type AuthUser, type Category, type Service, type ServiceFilters, apiClient, userSafeErrorMessage } from '../../lib/api';
import { useAreas, useCategories } from '@/hooks/useCategories';
import { useCatalogService } from '@/hooks/useCatalogService';
import { useServices } from '@/hooks/useServices';
import { CatalogPagination } from './components/CatalogPagination';
import { CatalogToolbar } from './components/CatalogToolbar';
import { ServiceCatalogTable } from './components/ServiceCatalogTable';
import { CategoryDrawer } from './components/CategoryDrawer';
import { ServiceDrawer } from './components/ServiceDrawer';
import { ServiceHistoryDialog } from './components/ServiceHistoryDialog';
import { invalidateCatalogQueries } from '@/lib/queryInvalidation';
import {
  CATEGORY_FILTER_ALL,
  STATUS_FILTER_ACTIVE,
  STATUS_FILTER_ALL,
} from './components/catalogTypes';
import { DANGER_BUTTON, FOCUS_RING, PRIMARY_BUTTON, SECONDARY_BUTTON, TEXTAREA_CLASS } from './components/catalogUi';
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
  const [categoryFilter, setCategoryFilter] = useState<string>(() => searchParams.get('category') ?? CATEGORY_FILTER_ALL);
  const [activeFilter, setActiveFilter] = useState<string>(() => searchParams.get('status') ?? STATUS_FILTER_ALL);
  const [page, setPage] = useState(() => positiveUrlInteger(searchParams.get('page'), 1));
  const [perPage, setPerPage] = useState(() => positiveUrlInteger(searchParams.get('per_page'), DEFAULT_PER_PAGE));
  const [lastServicesData, setLastServicesData] = useState<Awaited<ReturnType<typeof apiClient.getServicesPage>> | null>(null);
  const queryClient = useQueryClient();

  const [servicePendingStatusChange, setServicePendingStatusChange] = useState<Service | null>(null);
  const [serviceStatusError, setServiceStatusError] = useState('');
  const [serviceHistoryTarget, setServiceHistoryTarget] = useState<Service | null>(null);

  const canManageCatalog = useMemo(
    () => user.permissions.includes('catalog.manage'),
    [user.permissions],
  );

  // El único debounce vive en `useServices` (250 ms, aplicado sólo a `search`).
  // Aquí se pasa el término tal cual se teclea: el input nunca se retrasa.
  const serviceFilters = useMemo<ServiceFilters>(() => ({
    search,
    categoryId: categoryFilter !== CATEGORY_FILTER_ALL ? Number(categoryFilter) : undefined,
    active: activeFilter !== STATUS_FILTER_ALL ? activeFilter === STATUS_FILTER_ACTIVE : undefined,
    page,
    perPage,
  }), [activeFilter, categoryFilter, page, perPage, search]);

  const servicesQuery = useServices(serviceFilters);
  const categoriesQuery = useCategories();
  const areasQuery = useAreas(true);

  useEffect(() => {
    if (servicesQuery.data) {
      setLastServicesData(servicesQuery.data);
    }
  }, [servicesQuery.data]);

  const servicesData = servicesQuery.data ?? lastServicesData;
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const areas = areasQuery.data ?? [];
  const services = useMemo(() => servicesData?.data ?? [], [servicesData]);
  const requestedServiceId = positiveUrlInteger(searchParams.get('service'), 0) || null;
  const requestedServiceOnPage = requestedServiceId
    ? services.find((service) => service.id === requestedServiceId) ?? null
    : null;
  const serviceDetailQuery = useCatalogService(requestedServiceId && !requestedServiceOnPage ? requestedServiceId : null);
  const overlayState = catalogOverlayState(searchParams, services, categories, serviceDetailQuery.data ?? null);
  const meta = servicesData?.meta ?? { current_page: 1, per_page: DEFAULT_PER_PAGE, total: 0 };
  const serviceStatusActionLabel = servicePendingStatusChange?.active ? 'Desactivar concepto' : 'Activar concepto';
  const loadError = errorMessageFromQueries(servicesQuery.error, categoriesQuery.error, areasQuery.error);
  const isLoading = servicesQuery.isLoading && !servicesData;

  const hasFilters = search !== '' || categoryFilter !== CATEGORY_FILTER_ALL || activeFilter !== STATUS_FILTER_ALL;
  const isEmpty = services.length === 0 && !isLoading;

  useEffect(() => {
    searchParamsRef.current = searchParams;
    setSearchParamsRef.current = setSearchParams;
  }, [searchParams, setSearchParams]);

  // Sincroniza el estado local cuando la URL cambia por navegación externa
  // (atrás/adelante, enlaces profundos). Al teclear, `handleSearchChange` ya
  // deja el `q` en la URL, por lo que este efecto no reescribe el input.
  useEffect(() => {
    const nextSearch = searchParams.get('q') ?? '';
    const nextCategory = searchParams.get('category') ?? CATEGORY_FILTER_ALL;
    const nextStatus = searchParams.get('status') ?? STATUS_FILTER_ALL;
    const nextPage = positiveUrlInteger(searchParams.get('page'), 1);
    const nextPerPage = positiveUrlInteger(searchParams.get('per_page'), DEFAULT_PER_PAGE);

    setSearch((current) => current === nextSearch ? current : nextSearch);
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
    ]);
  }, [areasQuery, categoriesQuery, servicesQuery]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
    // La URL refleja lo tecleado al instante: `replace` evita una entrada de
    // historial por pulsación y no se espera al debounce de la consulta (que
    // ahora vive sólo en `useServices`).
    updateCatalogUrl({ q: value, page: null }, { replace: true });
  }

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

  function updateCatalogUrl(
    patch: Record<string, string | null>,
    options: { replace?: boolean } = {},
  ) {
    const next = new URLSearchParams(searchParamsRef.current);
    setOrDelete(next, 'q', search.trim());
    Object.entries(patch).forEach(([key, value]) => setOrDelete(next, key, value));
    searchParamsRef.current = next;

    setSearchParamsRef.current(next, options);
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    updateCatalogUrl({ page: nextPage > 1 ? String(nextPage) : null });
  }

  function handleServiceSuccess() {
    void invalidateCatalogQueries(queryClient);
    void refetchCatalogData();
    onStatus({ key: 'catalog:service:save', level: 'success', message: 'Producto o servicio guardado.' });
  }

  function handleCategorySuccess() {
    void invalidateCatalogQueries(queryClient);
    void refetchCatalogData();
    onStatus({ key: 'catalog:category:save', level: 'success', message: 'Categoría guardada exitosamente.' });
  }

  const toggleServiceActive = useCallback((service: Service) => {
    setServiceStatusError('');
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
      onStatus({ key: 'catalog:service:status', level: 'success', message: nextActive ? 'Concepto activado.' : 'Concepto desactivado.' });
    } catch (error) {
      const safeMessage = userSafeErrorMessage(error, 'No se pudo cambiar la disponibilidad del producto o servicio.');
      const message = safeMessage.includes('Si estaba cobrando')
        ? 'No se pudo confirmar el cambio. Revise el estado del concepto en el catálogo antes de intentarlo otra vez.'
        : safeMessage;
      setServiceStatusError(message);
      onStatus({ key: 'catalog:service:status', level: 'error', message });
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
    // La superficie ya vive dentro del landmark "Administración" (AdministracionView)
    // y del `main` del shell. El panel de cabecera de abajo aporta el landmark
    // "Catálogo institucional"; envolver todo en otro `region` con el mismo nombre
    // duplicaba el landmark (`landmark-unique`). El contenedor no necesita ser
    // landmark propio; conserva el `id` como ancla estable.
    <div
      id="catalogo"
      className="flex flex-col gap-4"
    >
      <AdminPageHeader
          headingId="catalog-title"
          title="Productos y servicios"
          description={canManageCatalog
            ? 'Administre nombres, categorías, precios, impuestos y disponibilidad para los próximos cobros.'
            : 'Consulte productos, servicios y precios vigentes.'}
          meta={<AdminChip tone="neutral">
            {isLoading
              ? 'Cargando catálogo…'
              : `${meta.total} concepto${meta.total !== 1 ? 's' : ''}`}
          </AdminChip>}
          actions={(
            <>
              {canManageCatalog ? (
                <>
                  <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={openNewCategory} aria-label="Crear nueva categoría">
                    <PlusIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />Nueva categoría
                  </button>
                  <button type="button" data-ui-press data-catalog-primary-action className={PRIMARY_BUTTON} onClick={openNewService} aria-label="Crear nuevo producto o servicio">
                    <PlusIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />Nuevo producto o servicio
                  </button>
                </>
              ) : (
                <AdminChip tone="neutral">Solo lectura</AdminChip>
              )}
            </>
          )}
        />

      <AdminPanel className="overflow-hidden">
        <CatalogToolbar
          categories={categories}
          categoryFilter={categoryFilter}
          hasActiveFilters={hasFilters}
          isLoading={isLoading}
          onActiveFilterChange={handleActiveFilterChange}
          onCategoryFilterChange={handleCategoryFilterChange}
          onClearFilters={clearFilters}
          onSearchChange={handleSearchChange}
          searchValue={search}
          statusFilter={activeFilter}
        />

        <ServiceCatalogTable
          canManage={canManageCatalog}
          isLoading={isLoading}
          loadError={loadError}
          onClearFilters={clearFilters}
          onRetry={refetchCatalogData}
          onRowActions={{ canManage: canManageCatalog, onEdit: openEditService, onHistory: setServiceHistoryTarget, onToggleActive: toggleServiceActive }}
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
      </AdminPanel>

      {requestedServiceId && serviceDetailQuery.isError ? (
        <AdminCallout tone="error" title="No se pudo abrir el producto o servicio solicitado">
          <p>El enlace no corresponde a un concepto disponible o el servidor local no respondió.</p>
          <button type="button" data-ui-press className={`${SECONDARY_BUTTON} mt-3`} onClick={() => updateCatalogUrl({ service: null }, { replace: true })}>
            Volver al catálogo
          </button>
        </AdminCallout>
      ) : null}

      {canManageCatalog && categories.length > 0 ? (
        <EditableCategoriesSection categories={categories} onEditCategory={openEditCategory} />
      ) : null}

      <ServiceHistoryDialog
        key={serviceHistoryTarget?.id ?? 'closed'}
        open={serviceHistoryTarget !== null}
        service={serviceHistoryTarget}
        onOpenChange={(open) => { if (!open) setServiceHistoryTarget(null); }}
      />

      {canManageCatalog ? (
        <>
          <ServiceDrawer
            open={overlayState.serviceDrawerOpen}
            onOpenChange={handleServiceDrawerOpenChange}
            service={overlayState.editingService ? normalizeServiceForDrawer(overlayState.editingService) : null}
            categories={categories}
            areas={areas}
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
            onCancel={() => { setServicePendingStatusChange(null); setServiceStatusError(''); }}
            onConfirm={(reason) => void confirmServiceStatusChange(reason)}
            open={servicePendingStatusChange !== null}
            reasonHelpText="Mínimo 5 caracteres. El motivo queda registrado en la auditoría del catálogo."
            requireReasonMinLength={5}
            title={serviceStatusActionLabel}
          >
            {servicePendingStatusChange?.active
              ? `El producto o servicio ${servicePendingStatusChange.name} quedará oculto para nuevos cobros. Los documentos ya emitidos no se modifican.`
              : `El producto o servicio ${servicePendingStatusChange?.name ?? ''} volverá a estar disponible para nuevos cobros. Los documentos ya emitidos no se modifican.`}
            {serviceStatusError ? <p role="alert" className="mt-3 text-[length:var(--ui-text-sm)] text-[color:var(--ui-danger)]">{serviceStatusError}</p> : null}
          </ConfirmDialog>
        </>
      ) : null}
    </div>
  );
}

function EditableCategoriesSection({ categories, onEditCategory }: { categories: Category[]; onEditCategory: (category: Category) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <AdminPanel as="section" aria-labelledby="catalog-categories-title">
      <h2 id="catalog-categories-title" className="sr-only">Categorías del catálogo</h2>
      <button
        type="button"
        data-ui-press
        aria-expanded={open}
        aria-controls="catalog-categories-content"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${FOCUS_RING}`}
      >
        <span className="min-w-0">
          <span className="block text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">Categorías del catálogo</span>
          <span className="block text-[length:var(--ui-text-xs)] font-normal text-[color:var(--ui-ink-soft)]">{categories.length} categorías · abrir para revisar estado y orden</span>
        </span>
        <ChevronDownIcon aria-hidden="true" className={`size-4 shrink-0 text-[color:var(--ui-ink-soft)] transition-transform duration-[120ms] ease-[var(--ui-ease-out)] ${open ? 'rotate-180' : ''}`} strokeWidth={1.5} />
      </button>
      {open ? (
        <div id="catalog-categories-content" className="border-t border-[var(--ui-line)] px-4 py-3">
          <ul className="divide-y divide-[var(--ui-line)]" aria-label="Categorías editables">
            {categories.map((category) => (
              <li key={category.id} className="flex flex-wrap items-center gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[color:var(--ui-ink)]">{category.name}</p>
                  <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                    Orden {category.sort_order} · {category.services_count ?? 0} producto(s) o servicio(s)
                  </p>
                </div>
                <StatusStamp status={category.active ? 'cobrado' : 'borrador'} label={category.active ? 'Activa' : 'Inactiva'} />
                <button type="button" data-ui-press className={SECONDARY_BUTTON} aria-label={`Editar categoría ${category.name}`} onClick={() => onEditCategory(category)}>
                  <EditIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />Editar
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AdminPanel>
  );
}

export function catalogOverlayState(
  searchParams: URLSearchParams,
  services: Service[],
  categories: Category[],
  requestedService: Service | null = null,
) {
  const requestedServiceId = positiveUrlInteger(searchParams.get('service'), 0);
  const requestedCategoryId = positiveUrlInteger(searchParams.get('edit_category'), 0);
  const requestedPanel = searchParams.get('panel');
  const editingService = requestedServiceId
    ? services.find((candidate) => candidate.id === requestedServiceId)
      ?? (requestedService?.id === requestedServiceId ? requestedService : null)
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
  if (!firstError) return '';
  const safeMessage = userSafeErrorMessage(firstError, 'No se pudo cargar el catálogo.');
  return safeMessage.includes('Si estaba cobrando')
    ? 'No se pudo cargar el catálogo. Revise la conexión local y vuelva a intentarlo.'
    : safeMessage;
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
}) {
  const [reason, setReason] = useState('');
  const reasonInvalid = reason.trim().length > 0 && reason.trim().length < requireReasonMinLength;
  return (
    <AdminDialog
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) { setReason(''); onCancel(); } }}
      title={title}
      description={children}
      footer={(
        <>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => { setReason(''); onCancel(); }}>Cancelar</button>
          <button
            type="button"
            data-ui-press
            className={danger ? DANGER_BUTTON : PRIMARY_BUTTON}
            disabled={reason.trim().length < requireReasonMinLength}
            onClick={() => { onConfirm(reason.trim() || null); setReason(''); }}
          >
            {confirmLabel}
          </button>
        </>
      )}
    >
      <AdminField htmlFor="catalog-audit-reason" label="Motivo de auditoría" hint={reasonHelpText} error={reasonInvalid ? `El motivo debe tener al menos ${requireReasonMinLength} caracteres.` : undefined}>
        <textarea
          id="catalog-audit-reason"
          className={TEXTAREA_CLASS}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-invalid={reasonInvalid}
          aria-describedby="catalog-audit-reason-hint"
        />
      </AdminField>
    </AdminDialog>
  );
}
