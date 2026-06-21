import { Barcode, Search } from 'lucide-react';
import { type KeyboardEvent, type RefObject, useEffect, useState, useCallback } from 'react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Skeleton } from '../../../components/ui/states';
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
  onAddByScanCode: () => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  scannerInputRef?: RefObject<HTMLInputElement | null>;
  loading?: boolean;
  scanningCode?: boolean;
  scannerEnabled?: boolean;
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
}: ServiceSearchProps) {
  const [addFirstWhenReady, setAddFirstWhenReady] = useState(false);
  const filteredServices = services.filter((service) => {
    const matchesArea =
      selectedAreaId === undefined ||
      selectedAreaId === 'all' ||
      service.area_id === selectedAreaId;
    const matchesCategory =
      selectedCategoryId === undefined ||
      selectedCategoryId === 'all' ||
      service.category_id === selectedCategoryId;

    return matchesArea && matchesCategory;
  });
  const hasIntent = Boolean(search.trim()) || selectedAreaId !== undefined || selectedCategoryId !== undefined;
  const visibleServices = hasIntent ? filteredServices.slice(0, SERVICE_RESULT_LIMIT) : [];
  const hiddenCount = Math.max(0, filteredServices.length - visibleServices.length);
  const firstVisibleService = visibleServices[0];
  const areaOptions = ['all', ...serviceAreas.map((area) => area.id)] as Array<number | 'all'>;
  const categoryOptions = ['all', ...categories.map((category) => category.id)] as Array<number | 'all'>;

  const handleAddService = useCallback((service: Service) => {
    setAddFirstWhenReady(false);
    onAddService(service);
    window.setTimeout(() => searchInputRef?.current?.focus(), 0);
  }, [onAddService, searchInputRef]);

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
    <div className="flex flex-col gap-4 lg:h-full lg:overflow-hidden">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 lg:shrink-0">
        <div className={scannerEnabled ? 'grid gap-3 sm:grid-cols-[1fr_minmax(14rem,18rem)]' : 'grid gap-3'}>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="service-search" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Buscar por nombre, categoría o código
            </Label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-secondary" aria-hidden="true" />
              <Input
                ref={searchInputRef}
                id="service-search"
                name="service_search"
                aria-label="Buscar por nombre, categoría o código"
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
                className="min-h-14 pl-12 text-base font-semibold"
              />
            </div>
          </div>

          {scannerEnabled ? (
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="scanner-code" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Scanner USB o código manual
              </Label>
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Barcode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary" aria-hidden="true" />
                  <Input
                    ref={scannerInputRef}
                    id="scanner-code"
                    name="scanner_code"
                    aria-label="Scanner USB o código manual"
                    placeholder="Código..."
                    value={scanCode}
                    onChange={(e) => onScanCodeChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (e.ctrlKey || e.metaKey || e.altKey) return;
                        e.preventDefault();
                        if (!scanningCode) onAddByScanCode();
                      }
                    }}
                    autoComplete="off"
                    disabled={scanningCode}
                    className="pl-9"
                  />
                </div>
                <Button type="button" variant="secondary" size="sm" className="min-h-10 shrink-0" disabled={scanningCode} onClick={() => onAddByScanCode()}>
                  {scanningCode ? 'Buscando...' : 'Escanear'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {serviceAreas.length > 0 && (
            <div className="min-w-0">
              <Label className="mb-2 block" id="service-area-label">Area</Label>
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
            <Label className="mb-2 block" id="service-category-label">Categoría</Label>
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

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="mb-2 flex items-center justify-between gap-3" aria-live="polite">
          <Label className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Servicios ({hasIntent ? filteredServices.length : 0})
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange('');
              onAreaChange(undefined);
              onCategoryChange(undefined);
            }}
          >
            Limpiar
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="status" aria-busy="true" aria-label="Cargando servicios">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : !hasIntent ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/35 px-4 py-10 text-center text-muted-foreground" role="status" aria-live="polite">
            <span className="font-medium text-foreground">Busque o elija una categoría</span>
            <span className="max-w-sm text-sm">
              Escriba el nombre del servicio, escanee un código o toque una categoría para ver opciones facturables.
            </span>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/35 px-4 py-10 text-center text-muted-foreground" role="status" aria-live="polite">
            <span className="font-medium text-foreground">Sin servicios encontrados</span>
            <span className="max-w-sm text-sm">Revise la búsqueda o quite filtros para consultar todo el catálogo activo.</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="list" aria-label="Servicios facturables disponibles">
              {visibleServices.map((service) => {
                const isErythropoietin = service.special_rule_code === ERYTHROPOIETIN_RULE;

                return (
                  <div key={service.id} role="listitem">
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`Agregar ${service.name} por ${moneyLabel(service.price)}`}
                      className="group h-full min-h-28 w-full items-stretch justify-start gap-3 p-3 text-left font-normal transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-secondary/45 hover:bg-accent/50 active:translate-y-px active:scale-[0.99]"
                      onClick={() => handleAddService(service)}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <p className="min-w-0 break-words text-sm font-semibold leading-tight text-foreground">{service.name}</p>
                          <span className="shrink-0 rounded-sm bg-secondary/12 px-2 py-1 font-mono text-sm font-semibold tabular-nums text-secondary">
                            {moneyLabel(service.price)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="info" className="rounded-sm px-1.5 py-0.5 text-[10px]">
                            {service.category?.name ?? 'Sin categoría'}
                          </Badge>
                          {service.area?.name ? (
                            <Badge variant="outline" className="rounded-sm px-1.5 py-0.5 text-[10px]">
                              {service.area.name}
                            </Badge>
                          ) : null}
                          {scannerEnabled && (service.scan_code || service.barcode || service.qr_code) && (
                            <span className="text-[10px] text-muted-foreground">
                              Disponible para lector
                            </span>
                          )}
                        </div>
                        {isErythropoietin && (
                          <p className="rounded-sm bg-muted px-1.5 py-1 text-[10px] text-muted-foreground">
                            Con receta diálisis = gratis
                          </p>
                        )}
                      </div>
                    </Button>
                  </div>
                );
              })}
            </div>
            {hiddenCount > 0 && (
              <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
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
        'min-h-10 rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-secondary bg-secondary text-secondary-foreground shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
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
