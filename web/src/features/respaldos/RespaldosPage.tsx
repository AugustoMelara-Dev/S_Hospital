import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CircleCheck, Database, Download, HardDrive, Plus, ServerCog, TriangleAlert } from 'lucide-react';
import { api, downloadFile, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import type { Backup, BackupPage, BackupStatus, SystemStatus } from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, IconButton, KpiTile, PageHeader, Skeleton, toast, type Tone } from '@/ui';

export const backupsKey = ['backups'] as const;
export const BACKUP_POLL_MS = 2000;

const STATUS: Record<BackupStatus, { label: string; tone: Tone }> = {
  pending: { label: 'En proceso', tone: 'info' },
  success: { label: 'Correcto', tone: 'ok' },
  failed: { label: 'Fallido', tone: 'danger' },
};

const DIALECT_LABEL: Record<string, string> = { mysql: 'MariaDB/MySQL', mariadb: 'MariaDB', sqlite: 'SQLite' };

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${i === 0 ? v : v.toFixed(1)} ${units[i]}`;
}

function SystemStatusCard() {
  const q = useQuery({ queryKey: ['system', 'status'], queryFn: () => api.get<SystemStatus>('/system/status'), refetchInterval: 60_000 });
  const s = q.data;
  const row = (label: string, value: ReactNode) => (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2 text-[13px] last:border-0">
      <span className="text-ink-2">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
  return (
    <Card title="Estado del sistema" actions={<ServerCog className="size-4 text-ink-3" aria-hidden="true" />}>
      {q.isLoading ? (
        <Skeleton lines={4} />
      ) : q.isError || !s ? (
        <p className="text-[13px] text-danger">{errorMessage(q.error, 'No se pudo consultar el estado.')}</p>
      ) : (
        <div className="flex flex-col">
          {row('Versión', <span className="num">{s.version}</span>)}
          {row(
            'Base de datos',
            <Badge tone="ok" dot>
              {[DIALECT_LABEL[s.database.dialect] ?? s.database.dialect, s.database.server_version].filter(Boolean).join(' ') || 'Conectada'}
            </Badge>,
          )}
          {row(
            'Migraciones',
            s.database.up_to_date === false ? <Badge tone="warn">Pendientes</Badge> : <Badge tone="ok">Al día</Badge>,
          )}
          {row(
            'Espacio en disco',
            s.disk ? (
              <span className="num">
                {formatBytes(s.disk.free_bytes)} libres de {formatBytes(s.disk.total_bytes)}
              </span>
            ) : (
              '—'
            ),
          )}
          {row('Último respaldo', s.backups.last_success ? <span className="tabular">{formatDateTime(s.backups.last_success.created_at)}</span> : 'Ninguno')}
        </div>
      )}
    </Card>
  );
}

function RestoreCard() {
  return (
    <Card title="Restaurar un respaldo">
      <div className="flex flex-col gap-2 text-[13px] text-ink-2">
        <p>
          La restauración reemplaza toda la base de datos y la realiza <strong className="text-ink">soporte técnico</strong> en el servidor,
          con la aplicación detenida. No se hace desde el navegador.
        </p>
        <ol className="ml-4 list-decimal space-y-1">
          <li>Descargue el respaldo y verifique su SHA-256.</li>
          <li>Detenga el servicio de la aplicación en el servidor.</li>
          <li>Restaure el archivo con la herramienta de soporte usando la clave de cifrado de respaldos.</li>
          <li>Inicie la aplicación y verifique el estado del sistema.</li>
        </ol>
        <p className="text-[12px] text-ink-3">El procedimiento detallado está en la guía de soporte del servidor.</p>
      </div>
    </Card>
  );
}

export default function RespaldosPage() {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canView = can('backups.view');
  const [confirm, setConfirm] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: backupsKey,
    enabled: canView,
    queryFn: async () => (await api.get<BackupPage>('/backups')).items,
    // Poll while any backup is still running.
    refetchInterval: (query) => (query.state.data?.some((b) => b.status === 'pending') ? BACKUP_POLL_MS : false),
  });
  const backups = q.data ?? [];
  const lastOk = backups.filter((b) => b.status === 'success').sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const failed = backups.filter((b) => b.status === 'failed').length;
  const running = backups.some((b) => b.status === 'pending');

  const create = useMutation({
    mutationFn: () => api.post<Backup>('/backups', {}),
    onSuccess: (b) => {
      if (b) qc.setQueryData<Backup[]>(backupsKey, (prev) => [b, ...(prev ?? []).filter((x) => x.id !== b.id)]);
      void qc.invalidateQueries({ queryKey: backupsKey });
      void qc.invalidateQueries({ queryKey: ['system', 'status'] });
      toast.info('Respaldo iniciado. El estado se actualizará automáticamente.');
      setConfirm(false);
    },
    onError: (e) => setCreateError(errorMessage(e)),
  });

  async function download(b: Backup) {
    try {
      await downloadFile(`/backups/${b.id}/download`, { mode: 'save', filename: b.filename });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Respaldos"
        description="Copias cifradas de la base de datos. Se crea una automáticamente cada día."
        actions={
          can('backups.create') && (
            <Button
              variant="primary"
              leftIcon={<Plus />}
              loading={running}
              loadingText="Respaldo en proceso…"
              onClick={() => {
                setCreateError(null);
                setConfirm(true);
              }}
            >
              Crear respaldo
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-4">
        {canView && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiTile
              label="Último exitoso"
              icon={<CircleCheck />}
              tone={lastOk ? 'ok' : 'warn'}
              loading={q.isLoading}
              value={lastOk ? formatDateTime(lastOk.created_at) : 'Ninguno'}
              hint={lastOk ? formatBytes(lastOk.size_bytes) : 'Cree un respaldo manual.'}
            />
            <KpiTile label="Respaldos registrados" icon={<Archive />} loading={q.isLoading} value={backups.length} />
            <KpiTile label="Fallidos" icon={<TriangleAlert />} tone={failed > 0 ? 'danger' : 'neutral'} loading={q.isLoading} value={failed} />
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          {canView ? (
            <Card flush title="Historial">
              <DataTable
                caption="Historial de respaldos"
                rows={q.data}
                loading={q.isLoading}
                rowKey={(b) => b.id}
                empty={<EmptyState compact icon={<Database />} title="Sin respaldos" description="Todavía no se ha creado ningún respaldo." />}
                columns={[
                  { key: 'date', header: 'Fecha', cell: (b) => <span className="tabular">{formatDateTime(b.created_at)}</span> },
                  { key: 'kind', header: 'Tipo', cell: (b) => (b.kind === 'scheduled' ? 'Automático' : 'Manual') },
                  { key: 'size', header: 'Tamaño', numeric: true, cell: (b) => formatBytes(b.size_bytes) },
                  {
                    key: 'status',
                    header: 'Estado',
                    cell: (b) => (
                      <span title={b.error ?? undefined}>
                        <Badge tone={STATUS[b.status].tone} dot>
                          {STATUS[b.status].label}
                        </Badge>
                      </span>
                    ),
                  },
                  {
                    key: 'sha',
                    header: 'SHA-256',
                    cell: (b) =>
                      b.sha256 ? (
                        <span className="num text-[12px] text-ink-2" title={b.sha256}>
                          {b.sha256.slice(0, 12)}…
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      ),
                  },
                ]}
                rowActions={
                  can('backups.download')
                    ? (b) => (
                        <IconButton
                          size="sm"
                          label={`Descargar respaldo del ${formatDateTime(b.created_at)}`}
                          icon={<Download />}
                          disabled={b.status !== 'success'}
                          onClick={() => void download(b)}
                        />
                      )
                    : undefined
                }
              />
            </Card>
          ) : (
            <Card>
              <EmptyState compact icon={<HardDrive />} title="Historial no disponible" description="Su rol no incluye ver respaldos." />
            </Card>
          )}
          <div className="flex flex-col gap-4">
            {can('system.status') && <SystemStatusCard />}
            <RestoreCard />
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Crear respaldo"
        description="Se generará una copia cifrada de la base de datos. La caja puede seguir operando."
        confirmLabel="Crear respaldo"
        loading={create.isPending}
        error={createError}
        onConfirm={() => create.mutate()}
      />
    </>
  );
}
