import type { InstitutionalColumn } from '@/design-system/ag-grid/InstitutionalDataGrid';
import { InstitutionalDataGrid } from '@/design-system/ag-grid/InstitutionalDataGrid';
import type { FiscalSequence } from '@/lib/api';
import { StatusBadge } from '../settingsAntd';

export function FiscalSequencesTable({ sequences }: { sequences: FiscalSequence[] }) {
  return <InstitutionalDataGrid ariaLabel="Secuencias fiscales registradas" columns={sequenceColumns} rows={sequences} getRowId={(sequence) => String(sequence.id ?? `${sequence.document_type}-${sequence.prefix}-${sequence.cai}`)} density="compact" height={420} emptyMessage="No hay secuencias fiscales" />;
}

const sequenceColumns: InstitutionalColumn<FiscalSequence>[] = [
  { headerName: 'Estado', cellRenderer: ({ data }: { data?: FiscalSequence }) => data ? <StatusBadge status={data.active ? 'success' : 'pending'}>{data.active ? 'Activa' : 'Inactiva'}</StatusBadge> : null },
  { field: 'document_type', headerName: 'Documento' },
  { field: 'prefix', headerName: 'Prefijo' },
  { headerName: 'Rango', valueGetter: ({ data }) => data ? `${formatSequenceNumber(data.min_number)} - ${formatSequenceNumber(data.max_number)}` : '' },
  { field: 'current_number', headerName: 'Correlativo', type: 'numericColumn', valueFormatter: ({ value }) => formatSequenceNumber(value == null ? null : Number(value)) },
  { field: 'valid_until', headerName: 'Válido hasta', valueFormatter: ({ value }) => String(value || '-') },
];

function formatSequenceNumber(value: number | null | undefined): string { return value == null ? '-' : String(value).padStart(8, '0'); }
