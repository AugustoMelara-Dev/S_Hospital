import { useMemo } from 'react';
import { Calendar, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import type { ExecutiveReportFilters } from '@/lib/api';

type ReportFiltersPanelProps = {
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
  rangeError?: string | null;
};

export type PresetKey = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'custom';

export const PRESET_LABELS: Record<PresetKey, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  last7: '7 dias',
  thisMonth: 'Este mes',
  lastMonth: 'Mes anterior',
  custom: 'Personalizado',
};

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computePresetRange(preset: PresetKey): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - 6);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  switch (preset) {
    case 'today':
      return { from: formatDate(today), to: formatDate(today) };
    case 'yesterday':
      return { from: formatDate(yesterday), to: formatDate(yesterday) };
    case 'last7':
      return { from: formatDate(startOfWeek), to: formatDate(today) };
    case 'thisMonth':
      return { from: formatDate(startOfMonth), to: formatDate(today) };
    case 'lastMonth':
      return { from: formatDate(startOfLastMonth), to: formatDate(endOfLastMonth) };
    case 'custom':
    default:
      return { from: formatDate(startOfMonth), to: formatDate(today) };
  }
}

function detectPreset(filters: ExecutiveReportFilters): PresetKey {
  const { from } = computePresetRange('today');
  if (filters.date_from === filters.date_to) {
    if (filters.date_from === from) return 'today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = formatDate(yesterday);
    if (filters.date_from === yKey) return 'yesterday';
  }
  const week = computePresetRange('last7');
  if (filters.date_from === week.from && filters.date_to === week.to) return 'last7';
  const month = computePresetRange('thisMonth');
  if (filters.date_from === month.from && filters.date_to === month.to) return 'thisMonth';
  const lastMonth = computePresetRange('lastMonth');
  if (filters.date_from === lastMonth.from && filters.date_to === lastMonth.to) return 'lastMonth';
  return 'custom';
}

export function ReportFiltersPanel({
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
  rangeError,
}: ReportFiltersPanelProps) {
  const inferredPreset = useMemo(() => detectPreset(filters), [filters]);

  function handlePresetChange(next: PresetKey) {
    onPresetChange(next);
    if (next !== 'custom') {
      onChange({ ...filters, ...computePresetRange(next) });
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="report-preset">Periodo rapido</Label>
            <NativeSelect
              id="report-preset"
              value={preset}
              onChange={(event) => handlePresetChange(event.target.value as PresetKey)}
              className="w-40"
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
              />
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-end gap-2">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExportPdf}
              disabled={loading || exporting || !canExport || Boolean(rangeError)}
              className="gap-1.5"
            >
              {exporting ? 'Exportando...' : 'PDF ejecutivo'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExportExcel}
              disabled={loading || exporting || !canExport || Boolean(rangeError)}
              className="gap-1.5"
            >
              {exporting ? 'Exportando...' : 'Excel ejecutivo'}
            </Button>
          </div>
        </div>

        {rangeError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {rangeError}
          </p>
        ) : inferredPreset !== preset ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="size-3" aria-hidden="true" />
            Rango personalizado. Total de dias: {daysInRange(filters.date_from, filters.date_to)}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function daysInRange(from: string, to: string): number {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}
