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
import { STRINGS, t } from '../../lib/i18n';

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
      const message = userSafeErrorMessage(error, t('catalog.loadErrorDefault'));
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
    queryClient.invalidateQueries({ queryKey: ['services'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    void loadCatalogData();
    onStatus(t('catalog.serviceSaved'));
  }

  function handleCategorySuccess() {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    void loadCatalogData();
    onStatus(t('catalog.categorySaved'));
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
          special_rule_code: service.special_rule_code,
        },
        service.id,
      );
      queryClient.invalidateQueries({ queryKey: ['services'] });
      void loadCatalogData();
      onStatus(service.active ? t('catalog.serviceDeactivated') : t('catalog.serviceActivated'));
    } catch {
      onStatus(t('catalog.toggleError'));
    }
  }, [loadCatalogData, onStatus, queryClient]);

  function normalizeServiceForSheet(service: Service) {
    return {
      ...service,
      scan_code: service.scan_code ?? null,
      barcode: service.barcode ?? null,
      qr_code: service.qr_code ?? null,
      special_rule_code: service.special_rule_code ?? null,
    };
  }

  return (
    <section id="catalogo" className="flex flex-col gap-5" aria-labelledby="catalog-title">
      <div className="flex items-center justify-between">
        <div>
          <h1 id="catalog-title" className="text-2xl font-bold tracking-tight">{t('catalog.title')}</h1>
          {!canManageCatalog && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t('catalog.readOnlyHint')}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {STRINGS.catalog.servicesCount(meta.total)}
          </p>
        </div>
        {canManageCatalog && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openNewCategory}>
              <Plus className="h-4 w-4 mr-2" />
              {t('catalog.newCategory')}
            </Button>
            <Button size="sm" onClick={openNewService}>
              <Plus className="h-4 w-4 mr-2" />
              {t('catalog.newService')}
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('catalog.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
              <SelectTrigger className="w-[200px]" aria-label={t('catalog.filterCategoryAria')}>
                <SelectValue placeholder={t('catalog.filterCategoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('catalog.filterAllCategories')}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={activeFilter} onValueChange={handleActiveFilterChange}>
              <SelectTrigger className="w-[150px]" aria-label={t('catalog.filterStateAria')}>
                <SelectValue placeholder={t('catalog.filterStatePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('catalog.filterAll')}</SelectItem>
                <SelectItem value="active">{t('catalog.filterActive')}</SelectItem>
                <SelectItem value="inactive">{t('catalog.filterInactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loadError ? (
        <Alert variant="destructive" title={t('catalog.loadErrorTitle')}>
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
                    <TableHead>{t('catalog.thName')}</TableHead>
                    <TableHead>{t('catalog.thCategory')}</TableHead>
                    <TableHead>{t('catalog.thArea')}</TableHead>
                    <TableHead>{t('catalog.thPrice')}</TableHead>
                    {scannerEnabled && <TableHead>{t('catalog.thCode')}</TableHead>}
                    <TableHead>{t('catalog.thState')}</TableHead>
                    {canManageCatalog && <TableHead className="text-right">{t('catalog.thActions')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    {scannerEnabled && <TableCell><Skeleton className="h-5 w-20" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    {canManageCatalog && <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>}
                  </TableRow>
                  <TableRow>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    {scannerEnabled && <TableCell><Skeleton className="h-5 w-20" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    {canManageCatalog && <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>}
                  </TableRow>
                  <TableRow>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    {scannerEnabled && <TableCell><Skeleton className="h-5 w-20" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    {canManageCatalog && <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>}
                  </TableRow>
                  <TableRow>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    {scannerEnabled && <TableCell><Skeleton className="h-5 w-20" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    {canManageCatalog && <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>}
                  </TableRow>
                  <TableRow>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    {scannerEnabled && <TableCell><Skeleton className="h-5 w-20" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    {canManageCatalog && <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : isEmpty && !loadError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Boxes className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('catalog.noServicesTitle')}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {hasFilters
                ? t('catalog.noServicesWithFilters')
                : t('catalog.noServicesEmpty')}
            </p>
            {hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                {t('catalog.clearFilters')}
              </Button>
            ) : canManageCatalog ? (
              <Button onClick={openNewService}>
                <Plus className="h-4 w-4 mr-2" />
                {t('catalog.newServiceButton')}
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
                    <TableHead>{t('catalog.thName')}</TableHead>
                    <TableHead>{t('catalog.thCategory')}</TableHead>
                    <TableHead>{t('catalog.thArea')}</TableHead>
                    <TableHead>{t('catalog.thPrice')}</TableHead>
                    {scannerEnabled && <TableHead>{t('catalog.thCode')}</TableHead>}
                    <TableHead>{t('catalog.thState')}</TableHead>
                    {canManageCatalog && (
                      <TableHead className="text-right">{t('catalog.thActions')}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id} className="border-b hover:bg-muted/30 transition-colors">
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium">{service.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">{service.category?.name ?? t('catalog.noCategory')}</TableCell>
                      <TableCell className="px-4 py-3 text-sm">{service.area?.name ?? t('catalog.noArea')}</TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="font-semibold">{moneyLabel(service.price)}</span>
                      </TableCell>
                      {scannerEnabled && (
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                          <div className="flex flex-col gap-1">
                            {([
                              [t('catalog.codeScan'), service.scan_code],
                              [t('catalog.codeBar'), service.barcode],
                              [t('catalog.codeQr'), service.qr_code],
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
                        <Badge variant={service.active ? 'default' : 'outline'}>
                          {service.active ? t('catalog.stateActive') : t('catalog.stateInactive')}
                        </Badge>
                      </TableCell>
                      {canManageCatalog && (
                        <TableCell className="px-4 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" aria-label={STRINGS.catalog.actionsAria(service.name)}>
                                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditService(service)}>
                                {t('catalog.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => toggleServiceActive(service)}
                                className={service.active ? 'text-destructive' : 'text-emerald-600'}
                              >
                                {service.active ? t('catalog.deactivate') : t('catalog.activate')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </div>
        </Card>
      ) : null}

      {!isEmpty && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {STRINGS.catalog.showing(services.length, meta.total)}
            </span>
            <Select value={String(perPage)} onValueChange={(v: string) => handlePerPageChange(Number(v))}>
              <SelectTrigger className="w-[100px]" aria-label={t('catalog.perPageAria')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">{t('catalog.perPage10')}</SelectItem>
                <SelectItem value="15">{t('catalog.perPage15')}</SelectItem>
                <SelectItem value="25">{t('catalog.perPage25')}</SelectItem>
                <SelectItem value="50">{t('catalog.perPage50')}</SelectItem>
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
