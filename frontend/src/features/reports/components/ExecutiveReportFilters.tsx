import { useMemo } from 'react';
import { Calendar, Download, FileText, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { CommandPanel } from '@/components/shared';
import type { ExecutiveReportFilters } from '@/lib/api';
import {
  PRESET_LABELS,
  computePresetRange,
  type PresetKey,
} from './reportDateRanges';

type ExecutiveReportFiltersProps = {
  filters: ExecutiveReportFilters;
  preset: PresetKey;
  onPresetChange: (preset: PresetKey) => void;
  onChange: (filters: ExecutiveReportFilters) => void;
  onRefresh: () => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  canExport: boolean;
  loading: boolean;
  exporting: boolean;
  titleLevel?: 1 | 2 | 3;
  rangeError?: string | null;
};

function detectPreset(filters: ExecutiveReportFilters): PresetKey {
  const { from } = computePresetRange('today');
  if (filters.date_from === filters.date_to) {
    if (filters.date_from === from) return 'today';
    const yesterday = computePresetRange('yesterday');
    if (filters.date_from === yesterday.from) return 'yesterday';
  }
  const week = computePresetRange('last7');
  if (filters.date_from === week.from && filters.date_to === week.to) return 'last7';
  const month = computePresetRange('thisMonth');
  if (filters.date_from === month.from && filters.date_to === month.to) return 'thisMonth';
  const lastMonth = computePresetRange('lastMonth');
  if (filters.date_from === lastMonth.from && filters.date_to === lastMonth.to) return 'lastMonth';
  return 'custom';
}

export function ExecutiveReportFilters({
  filters,
  preset,
  onPresetChange,
  onChange,
  onRefresh,
  onExportPdf,
  onExportExcel,
  canExport,
  loading,
  exporting,
  titleLevel,
  rangeError,
}: ExecutiveReportFiltersProps) {
  const inferredPreset = useMemo(() => detectPreset(filters), [filters]);
  const controlsDisabled = loading || exporting;

  function handlePresetChange(next: PresetKey) {
    onPresetChange(next);
    if (next !== 'custom') {
      const range = computePresetRange(next);
      onChange({ ...filters, date_from: range.from, date_to: range.to });
    }
  }

  return (
    <CommandPanel
      title="Control ejecutivo"
      titleLevel={titleLevel}
      description="Ajuste el periodo y actualice los indicadores con los datos del cierre operativo."
      className="bg-operational-surface"
      footer={
        rangeError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {rangeError}
          </p>
        ) : inferredPreset !== preset ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="size-3" aria-hidden="true" />
            Rango personalizado. Total de dias: {daysInRange(filters.date_from, filters.date_to)}.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Los reportes ejecutivos permiten rangos de hasta 31 dias.
          </p>
        )
      }
    >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[11rem_12rem_12rem_minmax(18rem,1fr)] xl:items-end">
          <div className="flex flex-col gap-1">
            <Label htmlFor="report-preset">Periodo rapido</Label>
            <NativeSelect
              id="report-preset"
              value={preset}
              onChange={(event) => handlePresetChange(event.target.value as PresetKey)}
              className="w-40"
              disabled={controlsDisabled}
            >
              {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => (
                <option key={key} value={key}>
                  {PRESET_LABELS[key]}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="report-from">Inicio ejecutivo</Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="report-from"
                type="date"
                value={filters.date_from}
                onChange={(event) => onChange({ ...filters, date_from: event.target.value })}
                className="pl-8"
                disabled={controlsDisabled}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="report-to">Fin ejecutivo</Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="report-to"
                type="date"
                value={filters.date_to}
                onChange={(event) => onChange({ ...filters, date_to: event.target.value })}
                className="pl-8"
                disabled={controlsDisabled}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 xl:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              disabled={loading || exporting || Boolean(rangeError)}
              className="gap-1.5"
            >
              <RefreshCw className={'size-4 ' + (loading ? 'animate-spin' : '')} aria-hidden="true" />
              Refrescar ejecutivo
            </Button>
            {canExport ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onExportPdf}
                  disabled={loading || exporting || Boolean(rangeError)}
                  className="gap-1.5"
                >
                  <FileText className="size-4" aria-hidden="true" />
                  {exporting ? 'Exportando...' : 'PDF ejecutivo'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onExportExcel}
                  disabled={loading || exporting || Boolean(rangeError)}
                  className="gap-1.5"
                >
                  <Download className="size-4" aria-hidden="true" />
                  {exporting ? 'Exportando...' : 'Excel ejecutivo'}
                </Button>
              </>
            ) : null}
          </div>
        </div>
    </CommandPanel>
  );
}

function daysInRange(from: string, to: string): number {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}
