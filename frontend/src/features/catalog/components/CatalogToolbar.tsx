import { SearchIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORY_FILTER_ALL, STATUS_FILTER_ACTIVE, STATUS_FILTER_ALL, STATUS_FILTER_INACTIVE, type CatalogToolbarProps } from './catalogTypes';

export function CatalogToolbar({ categories, categoryFilter, hasActiveFilters, isLoading, onActiveFilterChange, onCategoryFilterChange, onClearFilters, onSearchChange, searchInputId = 'catalog-search', searchValue, statusFilter }: CatalogToolbarProps) {
  return <section className="rounded-xl border border-border bg-card p-4 shadow-xs" aria-labelledby="catalog-filters-title">
    <h2 id="catalog-filters-title" className="mb-3 text-sm font-semibold">Filtros del catálogo</h2>
    <FieldGroup className="catalog-toolbar-grid grid gap-3 lg:items-end">
      <Field><FieldLabel htmlFor={searchInputId}>Buscar servicio</FieldLabel><div className="relative"><SearchIcon aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id={searchInputId} name="catalog_search" type="search" placeholder="Buscar por nombre, categoria o area..." value={searchValue} onChange={(event) => onSearchChange(event.target.value)} className="pl-8" /></div></Field>
      <Field><FieldLabel htmlFor="catalog-category">Categoría</FieldLabel><Select value={categoryFilter} onValueChange={onCategoryFilterChange}><SelectTrigger id="catalog-category" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value={CATEGORY_FILTER_ALL}>Todas las categorías</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
      <Field><FieldLabel htmlFor="catalog-active">Estado</FieldLabel><Select value={statusFilter} onValueChange={onActiveFilterChange}><SelectTrigger id="catalog-active" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value={STATUS_FILTER_ALL}>Todos</SelectItem><SelectItem value={STATUS_FILTER_ACTIVE}>Activos</SelectItem><SelectItem value={STATUS_FILTER_INACTIVE}>Inactivos</SelectItem></SelectGroup></SelectContent></Select></Field>
      <Button type="button" variant="outline" onClick={onClearFilters} disabled={isLoading || !hasActiveFilters} aria-label="Limpiar filtros de catálogo"><XIcon data-icon="inline-start" />Limpiar</Button>
    </FieldGroup>
  </section>;
}
