import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { type FormEvent, type ReactNode, useId, useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Card, CardContent } from './card';

interface FilterBarProps {
  actions?: ReactNode;
  advanced?: ReactNode;
  children: ReactNode;
  className?: string;
  clearLabel?: string;
  collapsibleAdvanced?: boolean;
  defaultAdvancedOpen?: boolean;
  hasActiveFilters?: boolean;
  isLoading?: boolean;
  onClear: () => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  searchLabel?: string;
}

export function FilterBar({
  actions,
  advanced,
  children,
  className,
  clearLabel = 'Limpiar',
  collapsibleAdvanced = false,
  defaultAdvancedOpen = false,
  hasActiveFilters = false,
  isLoading = false,
  onClear,
  onSearch,
  searchLabel = 'Buscar',
}: FilterBarProps) {
  const generatedId = useId();
  const advancedId = `${generatedId}-advanced`;
  const [advancedOpen, setAdvancedOpen] = useState(defaultAdvancedOpen);
  const showAdvanced = Boolean(advanced) && (!collapsibleAdvanced || advancedOpen);

  return (
    <Card
      data-slot="filter-bar"
      className={cn('overflow-hidden border-operational-border bg-card shadow-operational', className)}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/35 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#0c2733] text-[#80dfd0]">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Buscar y filtrar</p>
            <p className="text-xs text-muted-foreground">Reduzca el listado sin perder el contexto actual.</p>
          </div>
        </div>
        {hasActiveFilters ? <span className="rounded-md bg-warning/12 px-2 py-1 text-[11px] font-semibold text-warning-foreground">Filtros activos</span> : null}
      </div>
      <CardContent className="p-4 sm:p-5">
        <form onSubmit={onSearch} className="flex flex-col gap-4">
          <div
            data-slot="filter-bar-controls"
            className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          >
            {children}

            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 md:col-span-1">
              <Button type="submit" disabled={isLoading} className="min-h-10 flex-1 gap-2 bg-[#123f52] font-medium shadow-sm hover:bg-[#0c2733] sm:flex-initial">
                <Search data-icon aria-hidden="true" />
                {isLoading ? 'Buscando...' : searchLabel}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onClear}
                disabled={isLoading}
                className={cn(
                  'min-h-10 flex-1 gap-2 font-medium sm:flex-initial',
                  hasActiveFilters && 'border-warning/35 bg-warning/10 text-warning-foreground hover:bg-warning/15 dark:text-warning-foreground',
                )}
              >
                <RotateCcw data-icon aria-hidden="true" />
                {clearLabel}
              </Button>
            </div>
          </div>

          {advanced && collapsibleAdvanced ? (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-controls={advancedId}
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((open) => !open)}
              >
                <SlidersHorizontal data-icon aria-hidden="true" />
                Filtros avanzados
              </Button>
            </div>
          ) : null}

          {advanced && showAdvanced ? (
            <div id={advancedId} data-slot="filter-bar-advanced" className="grid gap-4">
              {advanced}
            </div>
          ) : null}

          {actions ? (
            <div data-slot="filter-bar-actions" className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              {actions}
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
