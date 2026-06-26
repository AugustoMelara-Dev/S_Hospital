import type { FormEvent } from 'react';
import { Search } from 'lucide-react';
import { DateRangePicker } from '../../../components/ui/date-range-picker';
import { FilterBar } from '../../../components/ui/filter-bar';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import type { InvoiceFilters } from '../../../lib/api';

type InvoiceHistoryFiltersProps = {
  filters: InvoiceFilters;
  hasActiveFilters: boolean;
  loading: boolean;
  onChange: (filters: InvoiceFilters) => void;
  onClear: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function InvoiceHistoryFilters({
  filters,
  hasActiveFilters,
  loading,
  onChange,
  onClear,
  onSubmit,
}: InvoiceHistoryFiltersProps) {
  return (
    <FilterBar
      className="border-operational-border"
      onSearch={(event) => onSubmit(event)}
      onClear={onClear}
      isLoading={loading}
      hasActiveFilters={hasActiveFilters}
    >
      <DateRangePicker
        startDate={filters.date_from ?? ''}
        endDate={filters.date_to ?? ''}
        onStartDateChange={(val) => onChange({ ...filters, date_from: val })}
        onEndDateChange={(val) => onChange({ ...filters, date_to: val })}
        className="col-span-1 sm:col-span-2"
      />

      <div className="space-y-1.5">
        <Label htmlFor="status" className="text-xs font-semibold text-muted-foreground">Estado</Label>
        <Select
          value={filters.status ?? 'all'}
          onValueChange={(value) => onChange({
            ...filters,
            status: value === 'all' ? '' : value as InvoiceFilters['status'],
          })}
        >
          <SelectTrigger id="status" aria-label="Estado de factura" className="h-10">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="issued">Emitida</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="paid">Pagada</SelectItem>
            <SelectItem value="void">Anulada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="patient" className="text-xs font-semibold text-muted-foreground">Paciente</Label>
        <div className="relative">
          <Search data-icon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="patient"
            placeholder="Nombre del paciente..."
            value={filters.patient ?? ''}
            onChange={(event) => onChange({ ...filters, patient: event.target.value })}
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invoice_number" className="text-xs font-semibold text-muted-foreground">Número de factura</Label>
        <div className="relative">
          <Search data-icon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="invoice_number"
            placeholder="A-0001..."
            value={filters.invoice_number ?? ''}
            onChange={(event) => onChange({ ...filters, invoice_number: event.target.value })}
            className="h-10 pl-9 font-mono tabular-nums"
          />
        </div>
      </div>
    </FilterBar>
  );
}
