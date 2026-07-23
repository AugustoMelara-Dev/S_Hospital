import { RefreshCwIcon } from 'lucide-react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ExecutiveReportFilters as Filters } from '@/lib/api';
import { PRESET_LABELS, computePresetRange, type PresetKey } from './reportDateRanges';
import { ReportExportMenu } from './ReportExportMenu';

type Props = { filters: Filters; preset: PresetKey; onPresetChange: (preset: PresetKey) => void; onChange: (filters: Filters) => void; onRefresh: () => void; onExportPdf: () => void; onExportExcel: () => void; canExport: boolean; loading: boolean; exporting: boolean; titleLevel?: 1 | 2 | 3; rangeError?: string | null; hasUnappliedChanges?: boolean };

export function ExecutiveReportFilters({ filters, preset, onPresetChange, onChange, onRefresh, onExportPdf, onExportExcel, canExport, loading, exporting, titleLevel = 2, rangeError, hasUnappliedChanges = false }: Props) {
  const disabled = loading || exporting;
  const Heading = `h${titleLevel}` as 'h1' | 'h2' | 'h3';
  const changePreset = (next: PresetKey) => {
    onPresetChange(next);
    if (next !== 'custom') {
      const range = computePresetRange(next);
      onChange({ ...filters, date_from: range.from, date_to: range.to });
    }
  };
  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="executive-controls-title">
      <Heading id="executive-controls-title" className="text-lg font-semibold">Resumen del período</Heading>
      <p className="mt-1 text-sm text-muted-foreground">Elija el período y actualice los indicadores. Puede consultar hasta 92 días.</p>
      <FieldGroup className="mt-4 grid gap-3 lg:grid-cols-4 lg:items-end">
        <Field>
          <FieldLabel htmlFor="report-preset">Periodo rápido</FieldLabel>
          <Select value={preset} disabled={disabled} onValueChange={(value) => changePreset(value as PresetKey)}>
            <SelectTrigger id="report-preset" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => <SelectItem key={key} value={key}>{PRESET_LABELS[key]}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </Field>
        <Field><FieldLabel htmlFor="report-from">Desde</FieldLabel><Input id="report-from" type="date" value={filters.date_from ?? ''} disabled={disabled} onChange={(event) => onChange({ ...filters, date_from: event.target.value })} /></Field>
        <Field><FieldLabel htmlFor="report-to">Hasta</FieldLabel><Input id="report-to" type="date" value={filters.date_to ?? ''} disabled={disabled} onChange={(event) => onChange({ ...filters, date_to: event.target.value })} /></Field>
        <div data-report-actions className="flex flex-wrap gap-2">
          <Button type="button" onClick={onRefresh} disabled={disabled || Boolean(rangeError)}><RefreshCwIcon data-icon="inline-start" className={loading ? 'animate-spin' : undefined} />Aplicar</Button>
          {canExport ? <ReportExportMenu onExportPdf={onExportPdf} onExportExcel={onExportExcel} exporting={exporting} disabled={disabled || hasUnappliedChanges || Boolean(rangeError)} /> : null}
        </div>
      </FieldGroup>
      {rangeError ? <Alert variant="destructive" className="mt-3"><AlertTitle>{rangeError}</AlertTitle></Alert> : hasUnappliedChanges ? <Alert className="mt-3"><AlertTitle>Aplique el período antes de exportar.</AlertTitle></Alert> : null}
    </section>
  );
}
