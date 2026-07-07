import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import type { BackupLog } from '@/lib/api';
import { formatLocalizedDateTime } from '@/lib/format/formatDate';
import { formatBytes } from '../backupPresentation';
import { BackupStatusBadge, getStatusDescription } from './BackupStatusBadge';

type BackupStatusFilter = 'all' | 'pending' | 'success' | 'failed';

type BackupHistoryTableProps = {
  backups: BackupLog[];
  canDownload: boolean;
  downloadingBackupId: number | null;
  onDownloadRequest: (backup: BackupLog) => void;
  onStatusFilterChange: (filter: BackupStatusFilter) => void;
  statusFilter: BackupStatusFilter;
};

const STATUS_FILTERS: BackupStatusFilter[] = ['all', 'pending', 'success', 'failed'];

export function BackupHistoryTable({
  backups,
  canDownload,
  downloadingBackupId,
  onDownloadRequest,
  onStatusFilterChange,
  statusFilter,
}: BackupHistoryTableProps) {
  const columns: Array<DataTableColumn<BackupLog>> = [
    {
      key: 'date',
      header: 'Fecha',
      headerClassName: 'w-40 whitespace-nowrap px-4 py-3',
      cellClassName: 'whitespace-nowrap px-4 py-3',
      render: (backup) => formatDate(backup.completed_at ?? backup.created_at),
    },
    {
      key: 'status',
      header: 'Estado',
      headerClassName: 'px-4 py-3',
      cellClassName: 'px-4 py-3',
      render: (backup) => (
        <div className="flex flex-col gap-1">
          <BackupStatusBadge status={backup.status} />
          <span className="text-xs text-muted-foreground">
            {getStatusDescription(backup.status)}
          </span>
          {backup.status === 'failed' && backup.error_message ? (
            <span className="max-w-[200px] truncate text-xs text-destructive">
              No se completó. Revise con soporte técnico.
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'size',
      header: 'Tamaño',
      headerClassName: 'w-24 whitespace-nowrap px-4 py-3',
      cellClassName: 'whitespace-nowrap px-4 py-3',
      numeric: true,
      render: (backup) => formatBytes(backup.size_bytes),
    },
    {
      key: 'creator',
      header: 'Usuario',
      headerClassName: 'w-44 whitespace-nowrap px-4 py-3',
      cellClassName: 'whitespace-nowrap px-4 py-3',
      render: (backup) => backup.creator?.name ?? 'Sistema',
    },
    {
      key: 'actions',
      header: 'Acciones',
      headerClassName: 'px-4 py-3 text-right',
      cellClassName: 'px-4 py-3 text-right',
      render: (backup) => (
        canDownload && backup.status === 'success' ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Descargar respaldo del ${formatDate(backup.completed_at ?? backup.created_at)}`}
            disabled={downloadingBackupId !== null}
            onClick={() => onDownloadRequest(backup)}
          >
            <Download aria-hidden="true" className="h-4 w-4" />
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">Sin descarga</span>
        )
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Filtros de estado de respaldos" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter}
            type="button"
            variant={statusFilter === filter ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={statusFilter === filter}
            onClick={() => onStatusFilterChange(filter)}
            className="h-8"
          >
            {filterLabel(filter)}
          </Button>
        ))}
      </div>

      <DataTable
        caption="Historial de respaldos locales con fecha, tamano, estado, usuario y acciones disponibles."
        columns={columns}
        containerLabel="Historial de respaldos locales"
        emptyAction={
          statusFilter === 'all' ? undefined : (
            <Button type="button" variant="outline" size="sm" onClick={() => onStatusFilterChange('all')}>
              Ver todos
            </Button>
          )
        }
        emptyDescription={
          statusFilter === 'all'
            ? 'Cree un respaldo local para proteger facturacion, caja y reportes.'
            : 'Quite el filtro para revisar todos los respaldos registrados.'
        }
        emptyTitle={statusFilter === 'all' ? 'No hay respaldos registrados' : 'No hay respaldos con este estado'}
        getRowKey={(backup) => backup.id}
        rows={backups}
        tableClassName="min-w-[960px]"
      />
    </div>
  );
}

function filterLabel(filter: BackupStatusFilter): string {
  if (filter === 'pending') return 'Pendientes';
  if (filter === 'success') return 'Completados';
  if (filter === 'failed') return 'Fallidos';
  return 'Todos';
}

function formatDate(value: string): string {
  return formatLocalizedDateTime(value);
}
