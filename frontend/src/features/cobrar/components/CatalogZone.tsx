import { useEffect, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, CornerDownLeftIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import {
  AdminCallout,
  AdminEmpty,
  AdminSearch,
  MoneyText,
} from '@/design-system/admin/components';
import { parseCents } from '@/lib/moneyCents';
import type { Category, Service } from '@/lib/api';
import { cn } from '@/lib/utils';
import { INPUT_CLASS, PICK_ROW, PICK_ROW_GLYPH, SECONDARY_BUTTON } from './cobrarUi';

type CatalogZoneProps = {
  canViewCatalog: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  categoryId: number | 'all';
  onCategoryChange: (value: number | 'all') => void;
  categories: Category[];
  services: Service[];
  loading: boolean;
  disabled?: boolean;
  error: string | null;
  onRetry: () => void;
  onAddFirst: () => void;
  onAdd: (service: Service) => void;
};

/**
 * Zona Catálogo / Inserción rápida en el ledger continuo.
 *
 * Flujo optimizado:
 * - Buscador amplio por nombre y código interno.
 * - Navegación accesible con teclado (Flechas Arriba/Abajo para elegir, Enter para agregar con cantidad 1).
 * - Enter en búsqueda NUNCA dispara cobro; mantiene el foco listo para el siguiente concepto.
 * - Accesos rápidos opcionales respaldados exclusivamente por el catálogo real.
 */
export function CatalogZone({
  canViewCatalog,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  categories,
  services,
  loading,
  disabled = false,
  error,
  onRetry,
  onAddFirst,
  onAdd,
}: CatalogZoneProps) {
  const filtering = search.trim().length > 0 || categoryId !== 'all';
  const [activeIndex, setActiveIndex] = useState(0);
  const [catalogExpanded, setCatalogExpanded] = useState(false);
  const [resultsDismissed, setResultsDismissed] = useState(false);
  const showResults = !resultsDismissed && (filtering || catalogExpanded);

  useEffect(() => {
    setActiveIndex(0);
  }, [search, categoryId, services.length]);

  useEffect(() => {
    function handleSearchNavigation(event: globalThis.KeyboardEvent) {
      if ((event.target as HTMLElement | null)?.id !== 'cobrar-catalog-search') return;
      if (!showResults) return;
      if (services.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((previous) => (previous + 1) % services.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((previous) => (previous - 1 + services.length) % services.length);
      } else if (event.key === 'Escape') {
        setActiveIndex(0);
        setCatalogExpanded(false);
        setResultsDismissed(true);
      }
    }

    document.addEventListener('keydown', handleSearchNavigation);
    return () => document.removeEventListener('keydown', handleSearchNavigation);
  }, [services.length, showResults]);

  const activeService = services[activeIndex] ?? services[0];
  const quickServices = services.slice(0, 4);
  const canSubmitResult = showResults && services.length > 0;

  function focusSearch() {
    const searchInput = document.getElementById('cobrar-catalog-search');
    if (searchInput instanceof HTMLInputElement) searchInput.focus({ preventScroll: true });
  }

  function finishResultSelection() {
    setActiveIndex(0);
    setCatalogExpanded(false);
    setResultsDismissed(true);
    onSearchChange('');
    focusSearch();
  }

  function handleSearchChange(value: string) {
    setResultsDismissed(false);
    onSearchChange(value);
  }

  function handleCategoryChange(value: number | 'all') {
    setActiveIndex(0);
    setResultsDismissed(false);
    onCategoryChange(value);
  }

  function handleResultAdd(service: Service) {
    onAdd(service);
    finishResultSelection();
  }

  function handleSearchSubmit() {
    if (!canSubmitResult) return;

    if (activeIndex === 0 && onAddFirst) {
      onAddFirst();
    } else if (activeService) {
      onAdd(activeService);
    }

    finishResultSelection();
  }

  return (
    <section aria-labelledby="cobrar-catalog-title" className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4 pb-2">
        <div>
          <h3 id="cobrar-catalog-title" className="text-[length:var(--ui-text-md)] font-semibold text-[color:var(--ui-ink)]">
            Agregar conceptos
          </h3>
          <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
            Busque por nombre o código. Enter agrega el resultado seleccionado.
          </p>
        </div>
        {canViewCatalog ? (
          <span role="status" className="text-[length:var(--ui-text-xs)] tabular-nums text-[color:var(--ui-ink-soft)]">
            {loading ? 'Buscando…' : `${services.length} resultado${services.length === 1 ? '' : 's'}`}
          </span>
        ) : null}
      </div>

      {!canViewCatalog ? (
        <div className="p-4">
          <AdminEmpty
            title="Sin permiso para consultar el catálogo"
            description="Su usuario no puede ver servicios. Solicite acceso al administrador."
          />
        </div>
      ) : (
        <fieldset
          disabled={disabled}
          aria-disabled={disabled || undefined}
          className="contents"
        >
          <div className="flex flex-wrap items-end gap-3 px-5 pb-4">
            <AdminSearch
              id="cobrar-catalog-search"
              label="Buscar servicio o producto"
              value={search}
              onValueChange={handleSearchChange}
              onSubmit={handleSearchSubmit}
              submitLabel="Agregar"
              submitAriaLabel={activeService ? `Agregar resultado: ${activeService.name}` : undefined}
              placeholder="Nombre o código"
              className={cn(
                'min-w-[15rem] flex-1 basis-[15rem] [&_[data-ui-focus-frame]]:border-[var(--ui-control-border)]',
                !canSubmitResult && '[&_[data-ui-press]]:invisible [&_[data-ui-press]]:pointer-events-none',
              )}
            />
            <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-48">
              <label
                htmlFor="cobrar-catalog-category"
                className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]"
              >
                Categoría
              </label>
              <select
                id="cobrar-catalog-category"
                value={categoryId === 'all' ? 'all' : String(categoryId)}
                onChange={(event) => handleCategoryChange(
                  event.target.value === 'all' ? 'all' : Number(event.target.value),
                )}
                className={INPUT_CLASS}
              >
                <option value="all">Todas</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!filtering && services.length > 0 ? (
            <div
              role="group"
              aria-label="Accesos rápidos"
              className="flex flex-wrap items-center gap-2 border-t border-[var(--ui-line)] px-5 py-3"
            >
              {quickServices.length > 0 ? (
                <>
                  <span className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">
                    Accesos rápidos:
                  </span>
                  {quickServices.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => onAdd(service)}
                      aria-label={`Agregar ${service.name} desde accesos rápidos`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)] transition-[background-color,border-color,transform] duration-[140ms] ease-out hover:border-[var(--ui-action)] hover:bg-[var(--ui-action-subtle)] hover:text-[color:var(--ui-action)] active:scale-[0.96] motion-reduce:active:scale-100"
                    >
                      <span>{service.name}</span>
                      <MoneyText cents={parseCents(service.price)} className="font-semibold text-[color:var(--ui-ink-soft)]" />
                    </button>
                  ))}
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setResultsDismissed(false);
                  setCatalogExpanded((current) => !current);
                }}
                className={`${SECONDARY_BUTTON} ml-auto [@media(pointer:coarse)]:h-11`}
                aria-expanded={catalogExpanded}
                aria-controls={catalogExpanded ? 'cobrar-catalog-results' : undefined}
              >
                {catalogExpanded ? (
                  <ChevronUpIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
                ) : (
                  <ChevronDownIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
                )}
                {catalogExpanded ? 'Ocultar catálogo' : 'Ver catálogo'}
              </button>
            </div>
          ) : null}

          {showResults || error ? <div className="flex min-h-0 flex-col border-t border-[var(--ui-line)]">
            {error ? (
              <div className="p-4">
                <AdminCallout tone="error" title="No se pudo cargar el catálogo">
                  <p>{error}</p>
                  <button type="button" onClick={onRetry} className={`${SECONDARY_BUTTON} mt-2`}>
                    <RefreshCwIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
                    Reintentar
                  </button>
                </AdminCallout>
              </div>
            ) : null}

            {!error && loading && services.length === 0 ? (
              <p
                role="status"
                className="px-4 py-6 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]"
              >
                Cargando catálogo…
              </p>
            ) : null}

            {!error && !(loading && services.length === 0) && services.length === 0 ? (
              <div className="p-4">
                <AdminEmpty
                  title={filtering ? 'Sin coincidencias' : 'Empiece a buscar'}
                  description={
                    filtering
                      ? 'Ajuste la búsqueda o la categoría para ver resultados.'
                      : 'Escriba el nombre de un servicio o elija una categoría.'
                  }
                />
              </div>
            ) : null}

            {!error && services.length > 0 ? (
              <ul
                id="cobrar-catalog-results"
                aria-label="Resultados del catálogo"
                className="flex max-h-[16rem] flex-col divide-y divide-[var(--ui-line)] overflow-y-auto"
              >
                {services.map((service, index) => {
                  const isSelected = index === activeIndex;

                  return (
                    <li key={service.id}>
                      <button
                        type="button"
                        onClick={() => handleResultAdd(service)}
                        onMouseEnter={() => setActiveIndex(index)}
                        aria-label={`Agregar ${service.name}`}
                        aria-current={isSelected ? 'true' : undefined}
                        className={cn(
                          PICK_ROW,
                          isSelected && 'bg-[var(--ui-action-subtle)] ring-1 ring-inset ring-[var(--ui-action)]',
                        )}
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium text-[color:var(--ui-ink)]">
                            {service.name}
                          </span>
                          <span className="truncate text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                            {service.category?.name ?? 'Sin categoría'}
                          </span>
                        </span>
                        <MoneyText cents={parseCents(service.price)} className="shrink-0 font-medium" />
                        <span aria-hidden="true" className={PICK_ROW_GLYPH}>
                          <PlusIcon className="size-4" strokeWidth={2} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {!error && services.length > 0 && activeService && search.trim() ? (
              <p className="flex items-center gap-1.5 border-t border-[var(--ui-line)] px-4 py-2 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                <CornerDownLeftIcon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
                Enter agrega <span className="font-medium text-[color:var(--ui-ink)]">{activeService.name}</span>
              </p>
            ) : null}
          </div> : null}
        </fieldset>
      )}
    </section>
  );
}
