import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type Area, type AuthUser, type Category, type Service, apiClient, userSafeErrorMessage } from '../../lib/api';
import { Plus, Search, MoreHorizontal, Boxes } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/alert';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { PaginationControls } from '../../components/ui/pagination';
import { Skeleton } from '../../components/ui/states';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { ServiceSheet } from './components/ServiceSheet';
import { CategorySheet } from './components/CategorySheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatLempirasFromCents, parseCents } from '../../lib/moneyCents';
import { getServiceBillingSummary } from '../../lib/serviceBilling';
import { invalidateCatalogQueries } from '@/lib/queryInvalidation';

type CatalogViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

export function CatalogView({ user, onStatus }: CatalogViewProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
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
  const meta = servicesData?.meta ?? { current_page: 1, per_page: 15, total: 0 };

  const hasFilters = search !== '' || categoryFilter !== 'all' || activeFilter !== 'all';
  const isEmpty = services.length === 0 && !isLoading;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const loadCatalogData = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [nextCategories, nextAreas, nextServices, fiscalSettings] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getAreas(true),
        apiClient.getServicesPage({
          search: debouncedSearch,
          categoryId: categoryFilter !== 'all' ? Number(categoryFilter) : undefined,
          active: activeFilter !== 'all' ? activeFilter === 'active' : undefined,
          page,
          perPage,
        }),
        apiClient.getFiscalSettings().catch(() => null),
      ]);
      setCategories(nextCategories);
      setAreas(nextAreas);
      setServicesData(nextServices);
      setScannerEnabled(fiscalSettings?.scanner_enabled === true);
    } catch (error) {
      const message = userSafeErrorMessage(error, 'No se pudo cargar el catalogo.');
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
    setCategoryFilter('all');
    setActiveFilter('all');
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
    onStatus('Categoria guardada exitosamente.');
  }

  const toggleServiceActive = useCallback(async (service: Service) => {
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
  }, [loadCatalogData, onStatus, queryClient]);

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
    <section id="catalogo" className="flex flex-col gap-5" aria-labelledby="catalog-title">
      <div className="flex items-center justify-between">
        <div>
          <h1 id="catalog-title" className="text-2xl font-bold tracking-tight">Catalogo de servicios</h1>
          {!canManageCatalog && (
            <p className="mt-1 text-sm text-muted-foreground">
              Cajero puede consultar catalogo y precios, sin permisos para modificar servicios.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {meta.total} servicio{meta.total !== 1 ? 's' : ''} en el catalogo
          </p>
        </div>
        {canManageCatalog && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openNewCategory}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva categoria
            </Button>
            <Button size="sm" onClick={openNewService}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo servicio
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px_150px]">
            <div className="flex min-w-[200px] flex-col gap-2">
              <label htmlFor="catalog-search" className="text-sm font-medium">
                Buscar servicio
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="catalog-search"
                  placeholder="Buscar por nombre o codigo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="catalog-category" className="text-sm font-medium">
                Categoria
              </label>
              <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
                <SelectTrigger id="catalog-category" className="w-full">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorias</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="catalog-active" className="text-sm font-medium">
                Estado
              </label>
              <Select value={activeFilter} onValueChange={handleActiveFilterChange}>
                <SelectTrigger id="catalog-active" className="w-full">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loadError ? (
        <Alert variant="destructive" title="No se pudo cargar el catalogo">
          {loadError}
        </Alert>
      ) : null}

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <div className="table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Precio</TableHead>
                    {scannerEnabled && <TableHead>Codigo</TableHead>}
                    <TableHead>Estado en caja</TableHead>
                    {canManageCatalog && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      {scannerEnabled && <TableCell><Skeleton className="h-5 w-20" /></TableCell>}
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      {canManageCatalog && <TableCell><Skeleton className="ml-auto h-5 w-12" /></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : isEmpty && !loadError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Boxes className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No hay servicios</h3>
            <p className="mb-4 text-center text-muted-foreground">
              {hasFilters
                ? 'No se encontraron servicios con los filtros seleccionados.'
                : 'Comience agregando su primer servicio al catalogo.'}
            </p>
            {hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : canManageCatalog ? (
              <Button onClick={openNewService}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo servicio
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : !loadError ? (
        <Card>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Precio</TableHead>
                  {scannerEnabled && <TableHead>Codigo</TableHead>}
                  <TableHead>Estado en caja</TableHead>
                  {canManageCatalog && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => {
                  const billingSummary = getServiceBillingSummary(service);

                  return (
                    <TableRow key={service.id} className="border-b transition-colors hover:bg-muted/30">
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{service.name}</span>
                          {billingSummary.reasons.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {billingSummary.reasons[0]}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">{service.category?.name ?? 'Sin categoria'}</TableCell>
                      <TableCell className="px-4 py-3 text-sm">{service.area?.name ?? 'Sin area'}</TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold">{moneyLabel(service.price)}</span>
                          {!billingSummary.hasConfiguredPrice && (
                            <span className="text-xs text-amber-700">Sin tarifa operativa</span>
                          )}
                        </div>
                      </TableCell>
                      {scannerEnabled && (
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                          <div className="flex flex-col gap-1">
                            {([
                              ['Escaner', service.scan_code],
                              ['Barra', service.barcode],
                              ['QR', service.qr_code],
                            ] as const)
                              .filter(([, code]) => Boolean(code))
                              .map(([label, code]) => (
                                <span key={`${service.id}-${label}`} className="text-xs">
                                  {label}: {code}
                                </span>
                              ))}
                            {!service.scan_code && !service.barcode && !service.qr_code && <span>-</span>}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {billingSummary.badges.map((badge) => (
                            <Badge key={`${service.id}-${badge.label}`} variant={badge.tone}>
                              {badge.label}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      {canManageCatalog && (
                        <TableCell className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" aria-label={`Acciones de servicio ${service.name}`}>
                                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditService(service)}>
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => toggleServiceActive(service)}
                                className={service.active ? 'text-destructive' : 'text-emerald-600'}
                              >
                                {service.active ? 'Desactivar' : 'Activar'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : null}

      {!isEmpty && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Mostrando {services.length} de {meta.total} servicios
            </span>
            <Select value={String(perPage)} onValueChange={(v: string) => handlePerPageChange(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 por pag</SelectItem>
                <SelectItem value="15">15 por pag</SelectItem>
                <SelectItem value="25">25 por pag</SelectItem>
                <SelectItem value="50">50 por pag</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PaginationControls
            loading={isLoading}
            meta={meta}
            onPageChange={setPage}
          />
        </div>
      )}

      {canManageCatalog && (
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
      )}
    </section>
  );
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasFromCents(parseCents(value));
}
