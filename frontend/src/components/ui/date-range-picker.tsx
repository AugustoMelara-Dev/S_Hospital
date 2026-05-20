import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { Input } from './input';
import { Label } from './label';
import { Button } from './button';

interface DateRangePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  showShortcuts?: boolean;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  showShortcuts = true,
  className,
  ...props
}: DateRangePickerProps) {
  
  const setQuickRange = (days: number) => {
    const today = new Date();
    const end = new Date();
    const start = new Date();
    start.setDate(today.getDate() - days);
    
    onStartDateChange(formatDate(start));
    onEndDateChange(formatDate(end));
  };

  const setThisMonth = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    onStartDateChange(formatDate(start));
    onEndDateChange(formatDate(today));
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end", className)} {...props}>
      <div className="flex-1 grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="range-start" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Desde
          </Label>
          <Input
            id="range-start"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full h-10 px-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-md focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="range-end" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Hasta
          </Label>
          <Input
            id="range-end"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full h-10 px-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-md focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
      </div>
      
      {showShortcuts && (
        <div className="flex flex-wrap gap-1.5 pb-0.5 mt-2 sm:mt-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuickRange(0)}
            className="h-8 text-xs font-medium border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Hoy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuickRange(1)}
            className="h-8 text-xs font-medium border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Ayer
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuickRange(7)}
            className="h-8 text-xs font-medium border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            7D
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={setThisMonth}
            className="h-8 text-xs font-medium border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Este mes
          </Button>
        </div>
      )}
    </div>
  );
}
