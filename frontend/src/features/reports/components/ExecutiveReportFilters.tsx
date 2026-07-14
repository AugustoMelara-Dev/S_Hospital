import dayjs from 'dayjs';
import { DownloadOutlined, FilePdfOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, DatePicker, Flex, Select, Space, Typography } from 'antd';
import type { ExecutiveReportFilters as Filters } from '@/lib/api';
import { PRESET_LABELS, computePresetRange, type PresetKey } from './reportDateRanges';

type Props = { filters: Filters; preset: PresetKey; onPresetChange: (preset: PresetKey) => void; onChange: (filters: Filters) => void; onRefresh: () => void; onExportPdf: () => void; onExportExcel: () => void; canExport: boolean; loading: boolean; exporting: boolean; titleLevel?: 1 | 2 | 3; rangeError?: string | null; hasUnappliedChanges?: boolean };

export function ExecutiveReportFilters({ filters, preset, onPresetChange, onChange, onRefresh, onExportPdf, onExportExcel, canExport, loading, exporting, titleLevel = 2, rangeError, hasUnappliedChanges = false }: Props) {
  const disabled = loading || exporting;
  const changePreset = (next: PresetKey) => { onPresetChange(next); if (next !== 'custom') { const range = computePresetRange(next); onChange({ ...filters, date_from: range.from, date_to: range.to }); } };
  return <section className="border border-border p-4" aria-labelledby="executive-controls-title">
    <Typography.Title id="executive-controls-title" level={titleLevel}>Control ejecutivo</Typography.Title>
    <Typography.Paragraph>Ajuste el periodo y actualice los indicadores con los datos del cierre operativo. Puede consultar hasta 92 días.</Typography.Paragraph>
    <Flex wrap gap={12} align="end">
      <label htmlFor="report-preset">Periodo rápido</label>
      <Select id="report-preset" aria-label="Periodo rápido" value={preset} disabled={disabled} onChange={changePreset} options={(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => ({ value: key, label: PRESET_LABELS[key] }))} />
      <label htmlFor="report-from">Inicio ejecutivo</label>
      <DatePicker id="report-from" aria-label="Inicio ejecutivo" value={filters.date_from ? dayjs(filters.date_from) : null} format="YYYY-MM-DD" disabled={disabled} onChange={(_, value) => onChange({ ...filters, date_from: String(value) })} />
      <label htmlFor="report-to">Fin ejecutivo</label>
      <DatePicker id="report-to" aria-label="Fin ejecutivo" value={filters.date_to ? dayjs(filters.date_to) : null} format="YYYY-MM-DD" disabled={disabled} onChange={(_, value) => onChange({ ...filters, date_to: String(value) })} />
      <Space><Button type="primary" icon={<ReloadOutlined spin={loading} />} onClick={onRefresh} disabled={disabled || Boolean(rangeError)}>Refrescar ejecutivo</Button>{canExport ? <><Button icon={<FilePdfOutlined />} onClick={onExportPdf} disabled={disabled || hasUnappliedChanges || Boolean(rangeError)}>{exporting ? 'Exportando...' : 'PDF ejecutivo'}</Button><Button icon={<DownloadOutlined />} onClick={onExportExcel} disabled={disabled || hasUnappliedChanges || Boolean(rangeError)}>{exporting ? 'Exportando...' : 'Excel ejecutivo'}</Button></> : null}</Space>
    </Flex>
    {rangeError ? <Alert type="error" title={rangeError} showIcon /> : hasUnappliedChanges ? <Alert type="warning" title="Aplique el período antes de exportar." showIcon /> : null}
  </section>;
}
