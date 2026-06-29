import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import type { FiscalSequence } from '@/lib/api';

type FiscalSequencesTableProps = {
  sequences: FiscalSequence[];
};

export function FiscalSequencesTable({ sequences }: FiscalSequencesTableProps) {
  return (
    <DataTable
      caption="Secuencias fiscales reales devueltas por el servidor. Las acciones de activar o editar usan el formulario autorizado."
      columns={sequenceColumns}
      containerLabel="Secuencias fiscales registradas"
      emptyDescription="Configure una secuencia autorizada antes de emitir facturas."
      emptyTitle="No hay secuencias fiscales"
      getRowKey={(sequence) => sequence.id ?? `${sequence.document_type}-${sequence.prefix}-${sequence.cai}`}
      rows={sequences}
      tableClassName="min-w-[760px]"
    />
  );
}

const sequenceColumns: Array<DataTableColumn<FiscalSequence>> = [
  {
    key: 'state',
    header: 'Estado',
    render: (sequence) => (
      <StatusBadge status={sequence.active ? 'success' : 'pending'}>
        {sequence.active ? 'Activa' : 'Inactiva'}
      </StatusBadge>
    ),
  },
  {
    key: 'document',
    header: 'Documento',
    cellClassName: 'capitalize',
    render: (sequence) => sequence.document_type,
  },
  {
    key: 'prefix',
    header: 'Prefijo',
    cellClassName: 'font-mono',
    render: (sequence) => sequence.prefix,
  },
  {
    key: 'range',
    header: 'Rango',
    cellClassName: 'font-mono tabular-nums',
    render: (sequence) => `${formatSequenceNumber(sequence.min_number)} - ${formatSequenceNumber(sequence.max_number)}`,
  },
  {
    key: 'current',
    header: 'Correlativo',
    cellClassName: 'font-mono tabular-nums',
    render: (sequence) => formatSequenceNumber(sequence.current_number),
  },
  {
    key: 'valid-until',
    header: 'Válido hasta',
    cellClassName: 'whitespace-nowrap',
    render: (sequence) => sequence.valid_until || '-',
  },
];

function formatSequenceNumber(value: number | null | undefined): string {
  if (value == null) return '-';

  return String(value).padStart(8, '0');
}
