import { type ReactNode, type FormEvent } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Search, RotateCcw } from 'lucide-react';
import { Card, CardContent } from './card';

interface FilterBarProps {
  children: ReactNode;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
  isLoading?: boolean;
  hasActiveFilters?: boolean;
  className?: string;
  searchLabel?: string;
  clearLabel?: string;
}

export function FilterBar({
  children,
  onSearch,
  onClear,
  isLoading = false,
  hasActiveFilters = false,
  className,
  searchLabel = 'Buscar',
  clearLabel = 'Limpiar',
}: FilterBarProps) {
  return (
    <Card className={cn('bg-card/90 transition-[border-color,box-shadow] duration-150 hover:shadow-md', className)}>
      <CardContent className="p-4 sm:p-5">
        <form onSubmit={onSearch} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {children}

            <div className="flex items-end gap-2 sm:col-span-2 md:col-span-1 lg:col-span-1 xl:col-span-1">
              <Button
                type="submit"
                disabled={isLoading}
                className="min-h-10 flex-1 gap-2 font-medium shadow-sm transition-colors duration-150 sm:flex-initial"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                {isLoading ? 'Buscando...' : searchLabel}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onClear}
                disabled={isLoading}
                className={cn(
                  'min-h-10 flex-1 gap-2 font-medium sm:flex-initial',
                  hasActiveFilters && 'border-warning/35 bg-warning/10 text-warning-foreground hover:bg-warning/15 dark:text-warning-foreground'
                )}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {clearLabel}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
