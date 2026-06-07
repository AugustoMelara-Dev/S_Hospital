import { Search } from 'lucide-react';
import { type RefObject, useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import type { Area, Category, Service } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { formatLempirasFromCents, parseCents } from '../../../lib/moneyCents';

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';
const SERVICE_RESULT_LIMIT = 24;

type ServiceSearchProps = {
  areas: Area[];
  categories: Category[];
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
  areas,
  categories,
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
  const searchInputLabel = scannerEnabled
    ? 'Buscar por nombre, categoria o identificador'
    : 'Buscar por nombre o categoria';
  const searchPlaceholder = scannerEnabled
    ? 'Buscar por nombre o identificador...'
    : 'Buscar por nombre...';
  const emptySearchHelp = scannerEnabled
    ? 'Escriba el nombre del servicio, use el identificador de escaneo o toque una categoria para ver opciones facturables.'
    : 'Escriba el nombre del servicio o toque una categoria para ver opciones facturables.';

  const handleAddService = useCallback((service: Service) => {
    setAddFirstWhenReady(false);
    onAddService(service);
    window.setTimeout(() => searchInputRef?.current?.focus(), 0);
  }, [onAddService, searchInputRef]);

  useEffect(() => {
    if (!addFirstWhenReady || loading || !firstVisibleService) return;
    handleAddService(firstVisibleService);
  }, [addFirstWhenReady, firstVisibleService, handleAddService, loading]);

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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              aria-label={searchInputLabel}
              placeholder={searchPlaceholder}
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
              className="pl-10"
            />
          </div>
          {scannerEnabled ? (
            <div className="flex gap-2">
              <div className="relative w-36">
                <Input
                  ref={scannerInputRef}
                  aria-label="Identificador de servicio"
                  placeholder="Identificador"
                  value={scanCode}
                  onChange={(e) => onScanCodeChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (e.ctrlKey || e.metaKey || e.altKey) return;
                      e.preventDefault();
                      onAddByScanCode();
                    }
                  }}
                />
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => onAddByScanCode()}>
                Escanear
              </Button>
            </div>
          ) : null}
        </div>

        <FilterGroup
          id="service-area-label"
          label="Area"
          options={areas.map((area) => ({ id: area.id, label: area.name }))}
          selectedId={selectedAreaId}
          onChange={onAreaChange}
          columnsClassName="sm:grid-cols-3 xl:grid-cols-4"
        />

        <div>
          <Label className="mb-2 block" id="service-category-label">Categoria</Label>
          <div
            aria-labelledby="service-category-label"
            className="grid max-h-28 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4"
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

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="flex items-center justify-between mb-2" aria-live="polite">
          <Label>Servicios ({hasIntent ? filteredServices.length : 0})</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange('');
              onAreaChange('all');
              onCategoryChange('all');
            }}
          >
            Limpiar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <span>Cargando servicios...</span>
          </div>
        ) : !hasIntent ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-muted-foreground">
            <span className="font-medium text-foreground">Busque o elija una categoria</span>
            <span className="max-w-sm text-sm">
              {emptySearchHelp}
            </span>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-muted-foreground">
            <span className="font-medium text-foreground">Sin servicios encontrados</span>
            <span className="max-w-sm text-sm">Revise la busqueda o quite filtros para consultar todo el catalogo activo.</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visibleServices.map((service) => {
              const isErythropoietin = service.special_rule_code === ERYTHROPOIETIN_RULE;
              return (
                <Button
                  key={service.id}
                  type="button"
                  variant="outline"
                  aria-label={`Agregar ${service.name} por ${moneyLabel(service.price)}`}
                  className="group relative h-auto min-h-24 items-center justify-start gap-3 p-3 text-left font-normal transition-transform hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm active:scale-[0.99]"
                  onClick={() => handleAddService(service)}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="pr-20 text-sm font-semibold leading-tight text-foreground">{service.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {service.category?.name ?? 'Sin categoria'}
                      </span>
                    </div>
                  </div>
                  <div className="absolute right-3 top-3">
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-1 text-sm font-semibold text-emerald-700">
                      {moneyLabel(service.price)}
                    </span>
                  </div>
                  {isErythropoietin && (
                    <div className="absolute bottom-1 right-3">
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Con receta dialisis = Gratis
                      </span>
                    </div>
                  )}
                </Button>
              );
            })}
            </div>
            {hiddenCount > 0 && (
              <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Mostrando {visibleServices.length} resultados. Afine la busqueda para ver los {hiddenCount} restantes.
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

function FilterGroup({
  id,
  label,
  options,
  selectedId,
  onChange,
  columnsClassName,
}: {
  id: string;
  label: string;
  options: Array<{ id: number; label: string }>;
  selectedId: number | 'all' | undefined;
  onChange: (id: number | 'all' | undefined) => void;
  columnsClassName: string;
}) {
  return (
    <div>
      <Label className="mb-2 block" id={id}>{label}</Label>
      <div
        aria-labelledby={id}
        className={cn('grid max-h-28 grid-cols-2 gap-2 overflow-y-auto pr-1', columnsClassName)}
        role="radiogroup"
      >
        <CategoryButton
          active={selectedId === undefined || selectedId === 'all'}
          label="Todos"
          onClick={() => onChange('all')}
        />
        {options.map((option) => (
          <CategoryButton
            key={option.id}
            active={selectedId === option.id}
            label={option.label}
            onClick={() => onChange(option.id)}
          />
        ))}
      </div>
    </div>
  );
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
