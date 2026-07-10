import { RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { SearchInput } from '../../../components/ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { cn } from '../../../lib/utils';
import {
  CATEGORY_FILTER_ALL,
  STATUS_FILTER_ACTIVE,
  STATUS_FILTER_ALL,
  STATUS_FILTER_INACTIVE,
  type CatalogToolbarProps,
} from './catalogTypes';

export function CatalogToolbar({
  categories,
  categoryFilter,
  hasActiveFilters,
  isLoading,
  onActiveFilterChange,
  onCategoryFilterChange,
  onClearFilters,
  onSearchChange,
  searchInputId = 'catalog-search',
  searchValue,
  statusFilter,
}: CatalogToolbarProps) {
  return (
    <Card className="overflow-hidden border-operational-border bg-operational-surface shadow-operational">
      <div className="border-b border-border bg-muted/35 px-5 py-3">
        <p className="text-sm font-semibold">Explorar catálogo</p>
        <p className="text-xs text-muted-foreground">Busque por nombre y refine por categoría o disponibilidad.</p>
      </div>
      <CardContent className="p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(18rem,1fr)_minmax(24rem,.9fr)] lg:items-end">
          <SearchInput
            id={searchInputId}
            name="catalog_search"
            label="Buscar servicio"
            placeholder="Buscar por nombre, categoria o area..."
            value={searchValue}
            onValueChange={onSearchChange}
            className="min-w-[200px]"
          />

          <div className="grid gap-4 rounded-xl bg-muted/45 p-4 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
          <div className="flex flex-col gap-2">
            <label htmlFor="catalog-category" className="text-sm font-medium">
              Categoría
            </label>
            <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
              <SelectTrigger id="catalog-category" className="w-full">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CATEGORY_FILTER_ALL}>Todas las categorías</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="catalog-active" className="text-sm font-medium">
              Estado
            </label>
            <Select value={statusFilter} onValueChange={onActiveFilterChange}>
              <SelectTrigger id="catalog-active" className="w-full">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_FILTER_ALL}>Todos</SelectItem>
                <SelectItem value={STATUS_FILTER_ACTIVE}>Activos</SelectItem>
                <SelectItem value={STATUS_FILTER_INACTIVE}>Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              disabled={isLoading || !hasActiveFilters}
              className={cn(
                'h-10 gap-2 px-3',
                hasActiveFilters &&
                  'border-warning/35 bg-warning/10 text-warning-foreground hover:bg-warning/15',
              )}
              aria-label="Limpiar filtros de catálogo"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Limpiar
            </Button>
          </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
