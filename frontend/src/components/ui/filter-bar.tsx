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
    <Card className={cn("border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-sm transition-all hover:shadow-md", className)}>
      <CardContent className="p-4 sm:p-5">
        <form onSubmit={onSearch} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
            {children}
            
            <div className="flex items-end gap-2 sm:col-span-2 md:col-span-1 lg:col-span-1 xl:col-span-1">
              <Button 
                type="submit" 
                disabled={isLoading}
                className="flex-1 sm:flex-initial min-h-10 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white font-medium shadow-sm transition-colors duration-150 gap-2"
              >
                <Search className="h-4 w-4" />
                {isLoading ? 'Buscando...' : searchLabel}
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClear}
                disabled={isLoading}
                className={cn(
                  "flex-1 sm:flex-initial min-h-10 font-medium border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 gap-2",
                  hasActiveFilters && "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                )}
              >
                <RotateCcw className="h-4 w-4" />
                {clearLabel}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
