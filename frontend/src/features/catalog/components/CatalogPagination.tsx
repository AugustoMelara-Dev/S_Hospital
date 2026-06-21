import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { PaginationControls } from '../../../components/ui/pagination';
import { PER_PAGE_OPTIONS, type CatalogPaginationProps } from './catalogTypes';

export function CatalogPagination({
  isLoading,
  meta,
  perPage,
  servicesCount,
  onPageChange,
  onPerPageChange,
}: CatalogPaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          Mostrando {servicesCount} de {meta.total} servicios
        </span>
        <Select
          value={String(perPage)}
          onValueChange={(value: string) => onPerPageChange(Number(value))}
        >
          <SelectTrigger className="w-[120px]" aria-label="Servicios por página">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PER_PAGE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option} por pág.
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <PaginationControls loading={isLoading} meta={meta} onPageChange={onPageChange} />
    </div>
  );
}
