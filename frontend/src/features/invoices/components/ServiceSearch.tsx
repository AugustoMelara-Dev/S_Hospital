import { BarcodeOutlined as Barcode, FilterOutlined as Filter, PlusOutlined as Plus, SearchOutlined as Search, CloseOutlined as X } from '@ant-design/icons';
import { type KeyboardEvent, type RefObject, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, Skeleton, Tag } from 'antd';
import type { Category, Service, ServiceArea } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';
const SERVICE_RESULT_LIMIT = 24;

type ServiceSearchProps = {
  categories: Category[];
  serviceAreas?: ServiceArea[];
  services: Service[];
  selectedAreaId?: number | 'all' | undefined;
  selectedCategoryId: number | 'all' | undefined;
  onAreaChange?: (id: number | 'all' | undefined) => void;
  onCategoryChange: (id: number | 'all' | undefined) => void;
  search: string;
  onSearchChange: (value: string) => void;
  scanCode: string;
  onScanCodeChange: (value: string) => void;
  onAddService: (service: Service) => void;
  onAddByScanCode: () => void | Promise<void>;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  scannerInputRef?: RefObject<HTMLInputElement | null>;
  loading?: boolean;
  scanningCode?: boolean;
  scannerEnabled?: boolean;
  error?: string;
  onRetry?: () => void;
};

export function ServiceSearch({
  categories,
  serviceAreas = [],
  services,
  selectedAreaId,
  selectedCategoryId,
  onAreaChange = () => undefined,
  onCategoryChange,
  search,
  onSearchChange,
  scanCode,
  onScanCodeChange,
  onAddService,
  onAddByScanCode,
  searchInputRef,
  scannerInputRef,
  loading,
  scanningCode = false,
  scannerEnabled = false,
  error,
  onRetry,
}: ServiceSearchProps) {
  const [addFirstWhenReady, setAddFirstWhenReady] = useState(false);
  const addLockRef = useRef<number | null>(null);
  const addLockTimeoutRef = useRef<number | null>(null);
  const scanLockRef = useRef(false);
  const scanLockTimeoutRef = useRef<number | null>(null);
  const deferredSearch = useDeferredValue(search);
  const deferredServices = useDeferredValue(services);
  const normalizedSearch = deferredSearch.trim().toLocaleLowerCase('es');
  const filteredServices = deferredServices.filter((service) => {
    const matchesArea =
      selectedAreaId === undefined ||
      selectedAreaId === 'all' ||
      service.area_id === selectedAreaId;
    const matchesCategory =
      selectedCategoryId === undefined ||
      selectedCategoryId === 'all' ||
      service.category_id === selectedCategoryId;
    const searchableText = [service.name, service.aliases, service.category?.name, service.area?.name]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('es');
    const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);

    return matchesArea && matchesCategory && matchesSearch;
  });
  const hasIntent = Boolean(search.trim()) || selectedAreaId !== undefined || selectedCategoryId !== undefined;
  const visibleServices = hasIntent ? filteredServices.slice(0, SERVICE_RESULT_LIMIT) : [];
  const hiddenCount = Math.max(0, filteredServices.length - visibleServices.length);
  const firstVisibleService = visibleServices[0];
  const areaOptions = ['all', ...serviceAreas.map((area) => area.id)] as Array<number | 'all'>;
  const categoryOptions = ['all', ...categories.map((category) => category.id)] as Array<number | 'all'>;
  const activeFilterCount = [search.trim(), selectedAreaId, selectedCategoryId].filter((value) => {
    return value !== '' && value !== undefined && value !== 'all';
  }).length;

  const handleAddService = useCallback((service: Service) => {
    if (addLockRef.current === service.id) return;

    addLockRef.current = service.id;
    setAddFirstWhenReady(false);
    onAddService(service);
    window.setTimeout(() => searchInputRef?.current?.focus(), 0);
    if (addLockTimeoutRef.current !== null) {
      window.clearTimeout(addLockTimeoutRef.current);
    }
    addLockTimeoutRef.current = window.setTimeout(() => {
      addLockRef.current = null;
      addLockTimeoutRef.current = null;
    }, 250);
  }, [onAddService, searchInputRef]);

  useEffect(() => () => {
    if (addLockTimeoutRef.current !== null) {
      window.clearTimeout(addLockTimeoutRef.current);
    }
    if (scanLockTimeoutRef.current !== null) {
      window.clearTimeout(scanLockTimeoutRef.current);
    }
  }, []);

  const handleAddByScanCode = useCallback(() => {
    if (scanningCode || scanLockRef.current) return;

    scanLockRef.current = true;
    const scheduleUnlock = () => {
      if (scanLockTimeoutRef.current !== null) {
        window.clearTimeout(scanLockTimeoutRef.current);
      }
      scanLockTimeoutRef.current = window.setTimeout(() => {
        scanLockRef.current = false;
        scanLockTimeoutRef.current = null;
      }, 250);
    };

    try {
      const result = onAddByScanCode();
      if (result instanceof Promise) {
        void result.then(scheduleUnlock, scheduleUnlock);
      } else {
        scheduleUnlock();
      }
    } catch {
      scheduleUnlock();
    }
  }, [onAddByScanCode, scanningCode]);

  const handleRadioGroupKeyDown = useCallback((
    event: KeyboardEvent<HTMLDivElement>,
    options: Array<number | 'all'>,
    selectedValue: number | 'all' | undefined,
    onChange: (id: number | 'all' | undefined) => void,
  ) => {
    const keyOffsets: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    const currentIndex = Math.max(0, options.findIndex((option) => option === (selectedValue ?? 'all')));
    let nextIndex = currentIndex;

    if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = options.length - 1;
    } else if (event.key in keyOffsets) {
      nextIndex = (currentIndex + keyOffsets[event.key] + options.length) % options.length;
    } else {
      return;
    }

    event.preventDefault();
    onChange(options[nextIndex]);
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    window.setTimeout(() => radios[nextIndex]?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!addFirstWhenReady || loading || !firstVisibleService) return;
    handleAddService(firstVisibleService);
  }, [addFirstWhenReady, firstVisibleService, loading, handleAddService]);

  useEffect(() => {
    setAddFirstWhenReady(false);
  }, [search, selectedAreaId, selectedCategoryId]);

  useEffect(() => {
    if (!loading && addFirstWhenReady && !firstVisibleService) {
      setAddFirstWhenReady(false);
    }
  }, [addFirstWhenReady, firstVisibleService, loading]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5 border border-operational-border bg-muted/40 p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Selección de servicios</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {scannerEnabled
                ? 'Filtre por area, categoria, texto o lector sin exponer datos internos.'
                : 'Filtre por nombre, area o categoria para agregar servicios.'}
            </p>
          </div>
          <Tag color={activeFilterCount > 0 ? 'processing' : 'default'} className="w-fit">
            {activeFilterCount} filtro{activeFilterCount === 1 ? '' : 's'}
          </Tag>
        </div>
        <div className={scannerEnabled ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'}>
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="service-search" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Buscar por nombre, area o categoria
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-secondary" aria-hidden="true" />
              <Input
                ref={(node) => {
                  if (searchInputRef) {
                    (searchInputRef as React.MutableRefObject<HTMLInputElement | null>).current = node?.input ?? null;
                  }
                }}
                id="service-search"
                name="service_search"
                aria-label="Buscar por nombre, area o categoria"
                placeholder="Glucosa, hemograma, eritropoyetina..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.ctrlKey || e.metaKey || e.altKey) return;
                    e.preventDefault();
                    if (firstVisibleService) {
                      handleAddService(firstVisibleService);
                      return;
                    }
                    if (loading || search.trim()) {
                      setAddFirstWhenReady(true);
                    }
                  }
                }}
                autoComplete="off"
                className="min-h-16 pl-12 text-base font-semibold"
              />
            </div>
          </div>

          {scannerEnabled ? (
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="scanner-code" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lector USB o entrada manual
              </label>
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Barcode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary" aria-hidden="true" />
                  <Input
                    ref={(node) => {
                      if (scannerInputRef) {
                        (scannerInputRef as React.MutableRefObject<HTMLInputElement | null>).current = node?.input ?? null;
                      }
                    }}
                    id="scanner-code"
                    name="scanner_code"
                    aria-label="Lector USB o entrada manual"
                    placeholder="Escanee o ingrese referencia..."
                    value={scanCode}
                    onChange={(e) => onScanCodeChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (e.ctrlKey || e.metaKey || e.altKey) return;
                        e.preventDefault();
                        handleAddByScanCode();
                      }
                    }}
                    autoComplete="off"
                    disabled={scanningCode}
                    className="min-h-11 pl-9"
                  />
                </div>
                <Button type="default" className="min-h-11 shrink-0" disabled={scanningCode} onClick={handleAddByScanCode}>
                  {scanningCode ? 'Buscando...' : 'Escanear'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {serviceAreas.length > 0 && (
            <div className="min-w-0">
              <span className="mb-2 block text-sm font-semibold text-foreground animate-none" id="service-area-label">Area</span>
              <div
                aria-labelledby="service-area-label"
                className="grid max-h-28 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3"
                onKeyDown={(event) => handleRadioGroupKeyDown(event, areaOptions, selectedAreaId, onAreaChange)}
                role="radiogroup"
                tabIndex={-1}
              >
                <CategoryButton
                  active={selectedAreaId === undefined || selectedAreaId === 'all'}
                  label="Todas"
                  onClick={() => onAreaChange('all')}
                />
                {serviceAreas.map((area) => (
                  <CategoryButton
                    key={area.id}
                    active={selectedAreaId === area.id}
                    label={area.name}
                    onClick={() => onAreaChange(area.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="min-w-0">
            <span className="mb-2 block text-sm font-semibold text-foreground animate-none" id="service-category-label">Categoría</span>
            <div
              aria-labelledby="service-category-label"
              className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-3"
              onKeyDown={(event) => handleRadioGroupKeyDown(event, categoryOptions, selectedCategoryId, onCategoryChange)}
              role="radiogroup"
              tabIndex={-1}
            >
              <CategoryButton
                active={selectedCategoryId === undefined || selectedCategoryId === 'all'}
                label="Todos"
                onClick={() => onCategoryChange('all')}
              />
              {categories.map((cat) => (
                <CategoryButton
                  key={cat.id}
                  active={selectedCategoryId === cat.id}
                  label={cat.name}
                  onClick={() => onCategoryChange(cat.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
          <div className="flex min-w-0 items-center gap-2">
            <Filter className="size-4 text-secondary" aria-hidden="true" />
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Servicios ({hasIntent ? filteredServices.length : 0})
            </label>
          </div>
          <Button
            type="text"
            className="min-h-11 w-fit"
            onClick={() => {
              onSearchChange('');
              onAreaChange(undefined);
              onCategoryChange(undefined);
            }}
          >
            <X className="mr-1 size-3.5" aria-hidden="true" />
            Limpiar
          </Button>
        </div>

        {error ? (
          <Alert type="error" showIcon title="No se pudieron cargar los servicios" description={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="min-w-0 flex-1">{error}</span>
              {onRetry ? (
                <Button type="default" size="small" onClick={onRetry}>
                  Reintentar
                </Button>
              ) : null}
            </div>
          } />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="status" aria-busy="true" aria-label="Cargando servicios">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton.Input key={index} active={false} block className="h-24" />
            ))}
          </div>
        ) : !hasIntent ? (
            <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/35 px-4 py-10 text-center text-muted-foreground" role="status" aria-live="polite">
            <span className="font-medium text-foreground">Busque o elija una categoría</span>
            <span className="max-w-sm text-sm">
              {scannerEnabled
                ? 'Escriba el nombre del servicio, use el lector o toque una categoria para ver opciones facturables.'
                : 'Escriba el nombre del servicio o toque una categoria para ver opciones facturables.'}
            </span>
          </div>
        ) : filteredServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/35 px-4 py-10 text-center text-muted-foreground" role="status" aria-live="polite">
            <span className="font-medium text-foreground">Sin servicios encontrados</span>
            <span className="max-w-sm text-sm">Revise la búsqueda o quite filtros para consultar todo el catálogo activo.</span>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2" role="list" aria-label="Servicios facturables disponibles">
              {visibleServices.map((service) => {
                const isErythropoietin = service.special_rule_code === ERYTHROPOIETIN_RULE;

                return (
                  <div key={service.id} role="listitem" className="flex min-w-0 flex-col justify-between gap-4 border border-operational-border bg-card p-4 hover:border-secondary/35">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="min-w-0 break-words text-sm font-semibold leading-tight text-foreground">{service.name}</p>
                        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-secondary">
                          {moneyLabel(service.price)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Tag color="processing" className="px-1.5 py-0.5 text-xs">
                          {service.category?.name ?? 'Sin categoría'}
                        </Tag>
                        {service.area?.name ? (
                          <Tag className="px-1.5 py-0.5 text-xs">
                            {service.area.name}
                          </Tag>
                        ) : null}
                        {scannerEnabled && (service.scan_code || service.barcode || service.qr_code) ? (
                          <span className="text-xs text-muted-foreground">Disponible para lector</span>
                        ) : null}
                      </div>
                      {isErythropoietin ? (
                        <p className="mt-2 text-xs font-medium text-warning">
                          Precio L 25.00; gratis solo con receta de diálisis autorizada.
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="primary"
                      aria-label={`Agregar ${service.name}`}
                      className="min-h-11 w-full shrink-0 sm:w-auto sm:self-end"
                      onClick={() => handleAddService(service)}
                      icon={<Plus className="size-4" aria-hidden="true" />}
                    >
                      Agregar
                    </Button>
                  </div>
                );
              })}
            </div>
            {hiddenCount > 0 && (
              <p className="mt-3 border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Mostrando {visibleServices.length} resultados. Afine la búsqueda para ver los {hiddenCount} restantes.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasUIFromCents(parseCents(value));
}

function CategoryButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-checked={active}
      className={cn(
        'min-h-11 border px-3 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-secondary bg-secondary text-white'
          : 'border-border bg-white text-muted-foreground hover:border-secondary/30 hover:bg-accent/45 hover:text-foreground',
      )}
      onClick={onClick}
      role="radio"
      tabIndex={active ? 0 : -1}
      type="button"
    >
      <span className="line-clamp-2 leading-tight">{label}</span>
    </button>
  );
}
