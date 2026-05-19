import { Search } from 'lucide-react';
import { type RefObject, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import type { Category, Service } from '../../../lib/api';

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';
const SERVICE_RESULT_LIMIT = 24;

type ServiceSearchProps = {
  categories: Category[];
  services: Service[];
  selectedCategoryId: number | 'all' | undefined;
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
};

export function ServiceSearch({
  categories,
  services,
  selectedCategoryId,
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
}: ServiceSearchProps) {
  const [addFirstWhenReady, setAddFirstWhenReady] = useState(false);
  const filteredServices = services.filter((service) => {
    const matchesCategory =
      selectedCategoryId === undefined ||
      selectedCategoryId === 'all' ||
      service.category_id === selectedCategoryId;

    return matchesCategory;
  });
  const hasIntent = Boolean(search.trim()) || (selectedCategoryId !== undefined && selectedCategoryId !== 'all');
  const visibleServices = hasIntent ? filteredServices.slice(0, SERVICE_RESULT_LIMIT) : [];
  const hiddenCount = Math.max(0, filteredServices.length - visibleServices.length);
  const firstVisibleService = visibleServices[0];

  function handleAddService(service: Service) {
    setAddFirstWhenReady(false);
    onAddService(service);
    window.setTimeout(() => searchInputRef?.current?.focus(), 0);
  }

  useEffect(() => {
    if (!addFirstWhenReady || loading || !firstVisibleService) return;
    handleAddService(firstVisibleService);
  }, [addFirstWhenReady, firstVisibleService, loading]);

  useEffect(() => {
    setAddFirstWhenReady(false);
  }, [search, selectedCategoryId]);

  useEffect(() => {
    if (!loading && addFirstWhenReady && !firstVisibleService) {
      setAddFirstWhenReady(false);
    }
  }, [addFirstWhenReady, firstVisibleService, loading]);

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:overflow-hidden">
      <div className="flex flex-col gap-3 lg:shrink-0">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              aria-label="Buscar por nombre, categoria o codigo"
              placeholder="Buscar por nombre o codigo..."
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
          <div className="flex gap-2">
            <div className="relative w-36">
              <Input
                ref={scannerInputRef}
                aria-label="Scanner USB o codigo manual"
                placeholder="Codigo"
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
        </div>

        <div>
          <Label className="mb-1.5 block" id="service-category-label">Categoria</Label>
          <Tabs
            value={selectedCategoryId === undefined ? 'all' : String(selectedCategoryId)}
            onValueChange={(v) => onCategoryChange(v === 'all' ? 'all' : Number(v))}
          >
            <TabsList
              aria-labelledby="service-category-label"
              className="flex h-auto max-w-full flex-nowrap gap-1 overflow-x-auto p-1"
            >
              <TabsTrigger value="all">Todos</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
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
              onCategoryChange(undefined);
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
            <span className="font-medium text-foreground">Busque, escanee o elija una categoria</span>
            <span className="max-w-md text-sm">
              Escanee un codigo, escriba el nombre o toque una categoria.
            </span>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Sin servicios encontrados
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visibleServices.map((service) => {
              const isErythropoietin = service.special_rule_code === ERYTHROPOIETIN_RULE;
              return (
                <button
                  key={service.id}
                  type="button"
                  aria-label={`Agregar ${service.name} por L. ${service.price}`}
                  className="group relative flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-all duration-150 hover:border-primary/40 hover:bg-accent/40 hover:scale-[1.02] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-card disabled:hover:border-border disabled:hover:shadow-none cursor-pointer"
                  onClick={() => handleAddService(service)}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="pr-20 text-sm font-semibold leading-tight text-foreground">{service.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {service.category?.name ?? 'Sin categoria'}
                      </span>
                      {(service.scan_code || service.barcode || service.qr_code) && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {service.scan_code ?? service.barcode ?? service.qr_code}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="absolute right-3 top-3">
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-1 text-sm font-semibold text-emerald-700">
                      L. {service.price}
                    </span>
                  </div>
                  {isErythropoietin && (
                    <div className="absolute bottom-1 right-3">
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Con receta dialisis = Gratis
                      </span>
                    </div>
                  )}
                </button>
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
