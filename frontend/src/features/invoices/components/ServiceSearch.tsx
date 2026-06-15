import { Search } from 'lucide-react';
import { type RefObject, useEffect, useState, useCallback } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Skeleton } from '../../../components/ui/states';
import type { Category, Service } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { formatLempirasFromCents, parseCents } from '../../../lib/moneyCents';

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';
const SERVICE_RESULT_LIMIT = 24;

type ServiceSearchProps = {
  categories: Category[];
  serviceAreas: ServiceArea[];
  services: Service[];
  selectedAreaId: number | 'all' | undefined;
  selectedCategoryId: number | 'all' | undefined;
  onAreaChange: (id: number | 'all' | undefined) => void;
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
  scannerEnabled?: boolean;
};

export function ServiceSearch({
  categories,
  serviceAreas,
  services,
  selectedAreaId,
  selectedCategoryId,
  onAreaChange,
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

  const handleAddService = useCallback((service: Service) => {
    setAddFirstWhenReady(false);
    onAddService(service);
    window.setTimeout(() => searchInputRef?.current?.focus(), 0);
  }, [onAddService, searchInputRef]);

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
      <div className="flex flex-col gap-3 lg:shrink-0">
        <div className={scannerEnabled ? 'grid gap-3 sm:grid-cols-[1fr_auto]' : 'grid gap-3'}>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="service-search" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Buscar servicio
            </Label>
            <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" aria-hidden="true" />
            <Input
              ref={searchInputRef}
              id="service-search"
              name="service_search"
              aria-label="Buscar por nombre, categoría o código"
              placeholder="Glucosa, hemograma, eritropoyetina…"
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
            <div className="flex items-end gap-2">
              <div className="relative w-40">
                <Label htmlFor="scanner-code" className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Scanner
                </Label>
                <Input
                  ref={scannerInputRef}
                  id="scanner-code"
                  name="scanner_code"
                  aria-label="Scanner USB o código manual"
                  placeholder="Codigo…"
                  value={scanCode}
                  onChange={(e) => onScanCodeChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (e.ctrlKey || e.metaKey || e.altKey) return;
                      e.preventDefault();
                      onAddByScanCode();
                    }
                  }}
                  autoComplete="off"
                />
              </div>
              <Button type="button" variant="secondary" size="sm" className="min-h-10" onClick={() => onAddByScanCode()}>
                Escanear
              </Button>
            </div>
          ) : null}
        </div>

        {serviceAreas.length > 0 && (
          <div>
            <Label className="mb-2 block" id="service-area-label">Area</Label>
            <div
              aria-labelledby="service-area-label"
              className="grid max-h-28 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4"
              role="radiogroup"
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

        <div>
          <Label className="mb-2 block" id="service-category-label">Categoria</Label>
          <div
            aria-labelledby="service-category-label"
            className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4"
            role="radiogroup"
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

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="flex items-center justify-between mb-2" aria-live="polite">
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Cargando servicios">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : !hasIntent ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/35 px-4 py-10 text-center text-muted-foreground">
            <span className="font-medium text-foreground">Busque o elija una categoría</span>
            <span className="max-w-sm text-sm">
              Escriba el nombre del servicio, escanee un código o toque una categoría para ver opciones facturables.
            </span>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/35 px-4 py-10 text-center text-muted-foreground">
            <span className="font-medium text-foreground">Sin servicios encontrados</span>
            <span className="max-w-sm text-sm">Revise la búsqueda o quite filtros para consultar todo el catálogo activo.</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visibleServices.map((service) => {
              const isErythropoietin = service.special_rule_code === ERYTHROPOIETIN_RULE;
              return (
                <Button
                  key={service.id}
                  type="button"
                  variant="outline"
                  aria-label={`Agregar ${service.name} por ${moneyLabel(service.price)}`}
                  className="group relative h-auto min-h-24 items-center justify-start gap-3 overflow-hidden p-3 text-left font-normal transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-secondary/45 hover:bg-accent/50 hover:shadow-sm active:translate-y-px active:scale-[0.99]"
                  onClick={() => handleAddService(service)}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="pr-20 text-sm font-semibold leading-tight text-foreground">{service.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {service.category?.name ?? 'Sin categoría'}
                      </span>
                      {scannerEnabled && (service.scan_code || service.barcode || service.qr_code) && (
                        <span className="text-[10px] text-muted-foreground">
                          Disponible para lector
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="absolute right-3 top-3">
                    <span className="inline-flex items-center rounded-sm bg-secondary/12 px-2 py-1 font-mono text-sm font-semibold tabular-nums text-secondary">
                      {moneyLabel(service.price)}
                    </span>
                  </div>
                  {isErythropoietin && (
                    <div className="absolute bottom-1 right-3">
                      <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        Con receta diálisis = gratis
                      </span>
                    </div>
                  )}
                </Button>
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
  return formatLempirasFromCents(parseCents(value));
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
      type="button"
    >
      <span className="line-clamp-2 leading-tight">{label}</span>
    </button>
  );
}
