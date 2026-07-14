import { DownloadOutlined } from '@ant-design/icons';
import { Button, Empty, Tag } from 'antd';
import type { InstitutionalColumn } from '@/design-system/ag-grid/InstitutionalDataGrid';
import { InstitutionalDataGrid } from '@/design-system/ag-grid/InstitutionalDataGrid';
import type { BackupLog } from '@/lib/api';
import { formatLocalizedDateTime } from '@/lib/format/formatDate';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { formatBytes } from '../backupPresentation';
import { BackupStatusBadge, getStatusDescription } from './BackupStatusBadge';

type BackupStatusFilter = 'all' | 'pending' | 'success' | 'failed';
type Props = { backups: BackupLog[]; canDownload: boolean; downloadingBackupId: number | null; onDownloadRequest: (backup: BackupLog) => void; onStatusFilterChange: (filter: BackupStatusFilter) => void; statusFilter: BackupStatusFilter };
const filterOptions = [{ label: 'Todos', value: 'all' }, { label: 'Pendientes', value: 'pending' }, { label: 'Completados', value: 'success' }, { label: 'Fallidos', value: 'failed' }];

export function BackupHistoryTable({ backups, canDownload, downloadingBackupId, onDownloadRequest, onStatusFilterChange, statusFilter }: Props) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const columns: InstitutionalColumn<BackupLog>[] = [
    { headerName: 'Fecha', valueGetter: ({ data }) => data ? formatDate(data.completed_at ?? data.created_at) : '' },
    { field: 'status', headerName: 'Estado', valueFormatter: ({ value }) => getStatusDescription(value as BackupLog['status']) },
    { field: 'size_bytes', headerName: 'Tamaño', type: 'numericColumn', valueFormatter: ({ value }) => formatBytes(value == null ? null : Number(value)) },
    { headerName: 'Usuario', valueGetter: ({ data }) => data?.creator?.name ?? 'Sistema' },
    { headerName: 'Acciones', cellRenderer: ({ data }: { data?: BackupLog }) => data && canDownload && data.status === 'success' ? <Button aria-label={`Descargar respaldo del ${formatDate(data.completed_at ?? data.created_at)}`} icon={<DownloadOutlined />} disabled={downloadingBackupId !== null} onClick={() => onDownloadRequest(data)} /> : <span>Sin descarga</span> },
  ];
  return <div className="space-y-4">
    <div role="group" aria-label="Filtros de estado de respaldos" className="flex flex-wrap gap-2">
      {filterOptions.map((option) => (
        <Button key={option.value} aria-pressed={statusFilter === option.value} onClick={() => onStatusFilterChange(option.value as BackupStatusFilter)}>
          {option.label}
        </Button>
      ))}
    </div>
    {isMobile ? backups.length ? <ul aria-label="Historial de respaldos locales">{backups.map((backup) => <li key={backup.id} className="border-b border-border p-4"><div className="flex justify-between gap-3"><div><strong>{formatDate(backup.completed_at ?? backup.created_at)}</strong><p>{backup.creator?.name ?? 'Sistema'} · {formatBytes(backup.size_bytes)}</p></div><BackupStatusBadge status={backup.status} /></div><p>{getStatusDescription(backup.status)}</p>{backup.status === 'failed' ? <Tag color="red">No se completó. Revise con soporte técnico.</Tag> : null}{canDownload && backup.status === 'success' ? <Button aria-label={`Descargar respaldo del ${formatDate(backup.completed_at ?? backup.created_at)}`} icon={<DownloadOutlined />} disabled={downloadingBackupId !== null} onClick={() => onDownloadRequest(backup)}>Descargar</Button> : <span>Sin descarga</span>}</li>)}</ul> : <Empty description={statusFilter === 'all' ? 'No hay respaldos registrados' : 'No hay respaldos con este estado'} />
      : <InstitutionalDataGrid ariaLabel="Historial de respaldos locales" columns={columns} rows={backups} getRowId={(row) => String(row.id)} density="compact" height={420} emptyMessage={statusFilter === 'all' ? 'No hay respaldos registrados' : 'No hay respaldos con este estado'} />}
  </div>;
}
function formatDate(value: string) { return formatLocalizedDateTime(value); }
