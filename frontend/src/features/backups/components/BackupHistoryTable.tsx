import { Download } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DataTable } from '@/design-system/patterns/DataTable';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { BackupLog } from '@/lib/api';
import { formatLocalizedDateTime } from '@/lib/format/formatDate';
import { formatBytes } from '../backupPresentation';
import { BackupStatusBadge, getStatusDescription } from './BackupStatusBadge';

type BackupStatusFilter = 'all' | 'pending' | 'success' | 'failed';
type Props = { backups: BackupLog[]; canDownload: boolean; downloadingBackupId: number | null; onDownloadRequest: (backup: BackupLog) => void; onStatusFilterChange: (filter: BackupStatusFilter) => void; statusFilter: BackupStatusFilter };
const filterOptions = [{ label: 'Todos', value: 'all' }, { label: 'Pendientes', value: 'pending' }, { label: 'Completados', value: 'success' }, { label: 'Fallidos', value: 'failed' }] as const;

export function BackupHistoryTable({ backups, canDownload, downloadingBackupId, onDownloadRequest, onStatusFilterChange, statusFilter }: Props) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const emptyMessage = statusFilter === 'all' ? 'No hay respaldos registrados' : 'No hay respaldos con este estado';
  const columns: ColumnDef<BackupLog>[] = [
    { id: 'date', header: 'Fecha', accessorFn: (row) => row.completed_at ?? row.created_at, cell: ({ row }) => formatDate(row.original.completed_at ?? row.original.created_at) },
    { accessorKey: 'status', header: 'Estado', cell: ({ row }) => <div className="flex flex-col gap-1"><BackupStatusBadge status={row.original.status} /><span className="text-xs text-muted-foreground">{getStatusDescription(row.original.status)}</span></div> },
    { accessorKey: 'size_bytes', header: 'Tamaño', meta: { numeric: true }, cell: ({ row }) => formatBytes(row.original.size_bytes) },
    { id: 'user', header: 'Usuario', accessorFn: (row) => row.creator?.name ?? 'Sistema' },
    { id: 'actions', header: 'Acciones', cell: ({ row }) => <DownloadAction backup={row.original} canDownload={canDownload} downloadingBackupId={downloadingBackupId} onDownloadRequest={onDownloadRequest} /> },
  ];

  return <div className="flex flex-col gap-4">
    <ToggleGroup type="single" variant="outline" size="sm" value={statusFilter} onValueChange={(value) => { if (value) onStatusFilterChange(value as BackupStatusFilter); }} aria-label="Filtros de estado de respaldos">
      {filterOptions.map((option) => <ToggleGroupItem key={option.value} value={option.value}>{option.label}</ToggleGroupItem>)}
    </ToggleGroup>
    {isMobile ? backups.length ? (
      <ul aria-label="Historial de respaldos locales" className="flex flex-col">
        {backups.map((backup) => <li key={backup.id} className="flex flex-col gap-3 border-b p-4">
          <div className="flex justify-between gap-3"><div><strong>{formatDate(backup.completed_at ?? backup.created_at)}</strong><p className="text-sm text-muted-foreground">{backup.creator?.name ?? 'Sistema'} · {formatBytes(backup.size_bytes)}</p></div><BackupStatusBadge status={backup.status} /></div>
          <p className="text-sm text-muted-foreground">{getStatusDescription(backup.status)}</p>
          {backup.status === 'failed' ? <Badge variant="destructive">No se completó. Revise con soporte técnico.</Badge> : null}
          <DownloadAction backup={backup} canDownload={canDownload} downloadingBackupId={downloadingBackupId} onDownloadRequest={onDownloadRequest} showLabel />
        </li>)}
      </ul>
    ) : <Empty><EmptyHeader><EmptyTitle>{emptyMessage}</EmptyTitle><EmptyDescription>Los respaldos locales aparecerán aquí cuando estén disponibles.</EmptyDescription></EmptyHeader></Empty>
      : <DataTable ariaLabel="Historial de respaldos locales" caption="Historial de respaldos locales con fecha, tamaño, estado, usuario y acciones disponibles." columns={columns} data={backups} getRowId={(row) => String(row.id)} emptyTitle={emptyMessage} />}
  </div>;
}

function DownloadAction({ backup, canDownload, downloadingBackupId, onDownloadRequest, showLabel = false }: { backup: BackupLog; canDownload: boolean; downloadingBackupId: number | null; onDownloadRequest: (backup: BackupLog) => void; showLabel?: boolean }) {
  if (!canDownload || backup.status !== 'success') return <span className="text-sm text-muted-foreground">Sin descarga</span>;
  return <Button size="sm" variant="outline" aria-label={`Descargar respaldo del ${formatDate(backup.completed_at ?? backup.created_at)}`} disabled={downloadingBackupId !== null} onClick={() => onDownloadRequest(backup)}><Download data-icon="inline-start" />{showLabel ? 'Descargar' : null}</Button>;
}

function formatDate(value: string) { return formatLocalizedDateTime(value); }
