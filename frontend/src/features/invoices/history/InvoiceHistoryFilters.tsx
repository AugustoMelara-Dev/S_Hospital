import { ChevronDownIcon, ChevronUpIcon, SearchIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { InvoiceFilters } from '../../../lib/api';

type Props = {
  filters: InvoiceFilters;
  hasActiveFilters: boolean;
  loading: boolean;
  onApply: (filters: InvoiceFilters) => void;
  onClear: () => void;
};

export function InvoiceHistoryFilters({ filters, hasActiveFilters, loading, onApply, onClear }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [draft, setDraft] = useState(filters);
  const draftRef = useRef(filters);
  const update = (patch: Partial<InvoiceFilters>) => setDraft((current) => {
    const next = { ...current, ...patch, page: 1 };
    draftRef.current = next;
    return next;
  });
  const hasDraftChanges = JSON.stringify(draft) !== JSON.stringify(filters);

  useEffect(() => {
    draftRef.current = filters;
    setDraft(filters);
  }, [filters]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply({ ...draftRef.current, page: 1 });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-end gap-4">
        <SearchField id="patient" label="Paciente" placeholder="Nombre del paciente..." value={draft.patient ?? ''} onChange={(value) => update({ patient: value })} className="w-56" />
        <SearchField id="invoice_number" label="Número de factura" placeholder="A-0001..." value={draft.invoice_number ?? ''} onChange={(value) => update({ invoice_number: value })} className="w-48" />

        <Button type="button" variant="outline" onClick={() => setShowAdvanced((current) => !current)} aria-expanded={showAdvanced}>
          {showAdvanced ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
          Filtros avanzados
        </Button>

        {showAdvanced ? (
          <>
            <DateFilter label="Desde" value={draft.date_from} onChange={(value) => update({ date_from: value })} />
            <DateFilter label="Hasta" value={draft.date_to} onChange={(value) => update({ date_to: value })} />
            <div className="grid gap-1.5">
              <Label htmlFor="status">Estado</Label>
              <Select value={draft.status || 'all'} onValueChange={(value) => update({ status: value === 'all' ? '' : value as InvoiceFilters['status'] })}>
                <SelectTrigger id="status" aria-label="Estado de factura" className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="issued">Emitida</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="paid">Pagada</SelectItem>
                  <SelectItem value="void">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}

        <Button type="submit" disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</Button>
        <Button type="button" variant="outline" disabled={(!hasActiveFilters && !hasDraftChanges) || loading} onClick={onClear}>Limpiar</Button>
      </div>
    </form>
  );
}

function SearchField({ className, id, label, onChange, placeholder, value }: { className: string; id: string; label: string; onChange: (value: string) => void; placeholder: string; value: string }) {
  return <div className="grid gap-1.5"><Label htmlFor={id}>{label}</Label><div className="relative"><SearchIcon aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id={id} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className={`${className} pl-8`} /></div></div>;
}

function DateFilter({ label, onChange, value }: { label: string; onChange: (value: string) => void; value?: string }) {
  const selected = value ? parseISO(value) : undefined;
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild><Button type="button" variant="outline" aria-label={label} className="w-40 justify-start font-normal">{selected ? format(selected, 'dd/MM/yyyy') : 'Seleccionar'}</Button></PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={es}
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
            components={{ DayButton: (props) => <CalendarDayButton {...props} title={format(props.day.date, 'yyyy-MM-dd')} /> }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
