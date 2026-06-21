import { type HTMLAttributes, useId } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Input } from './input';
import { Label } from './label';
import { Button } from './button';

interface DateRangePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  disabled?: boolean;
  endDate: string;
  endLabel?: string;
  error?: string;
  idPrefix?: string;
  onClear?: () => void;
  onEndDateChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  showShortcuts?: boolean;
  startDate: string;
  startLabel?: string;
}

export function DateRangePicker({
  className,
  disabled = false,
  endDate,
  endLabel = 'Hasta',
  error,
  idPrefix,
  onClear,
  onEndDateChange,
  onStartDateChange,
  showShortcuts = true,
  startDate,
  startLabel = 'Desde',
  ...props
}: DateRangePickerProps) {
  const generatedId = useId();
  const baseId = idPrefix ?? generatedId;
  const startId = `${baseId}-start`;
  const endId = `${baseId}-end`;
  const errorId = `${baseId}-error`;

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

  return (
    <div data-slot="date-range-picker" className={cn('flex flex-col gap-3 sm:flex-row sm:items-end', className)} {...props}>
      <div className="grid flex-1 grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={startId} className="text-xs font-semibold text-muted-foreground">
            {startLabel}
          </Label>
          <Input
            id={startId}
            type="date"
            value={startDate}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={endId} className="text-xs font-semibold text-muted-foreground">
            {endLabel}
          </Label>
          <Input
            id={endId}
            type="date"
            value={endDate}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {showShortcuts ? (
        <div className="flex flex-wrap gap-1.5 pb-0.5 sm:mt-0">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setQuickRange(0)} className="h-8 text-xs font-medium">
            Hoy
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setQuickRange(1)} className="h-8 text-xs font-medium">
            Ayer
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setQuickRange(7)} className="h-8 text-xs font-medium">
            7D
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={setThisMonth} className="h-8 text-xs font-medium">
            Este mes
          </Button>
          {onClear ? (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClear} className="h-8 text-xs font-medium">
              <RotateCcw data-icon aria-hidden="true" />
              Limpiar
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-sm font-semibold text-destructive sm:basis-full">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
