import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Download, HardDrive, Plus } from 'lucide-react';
import { api, downloadFile, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import type { Backup, BackupPage, BackupStatus, SystemStatus } from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { Button, ConfirmDialog, DataTable, EmptyState, IconButton, KpiGrid, KpiTile, PageHeader, Skeleton, toast, type GlyphShape, type Tone } from '@/ui';
import { Count, Dash, LedgerFact, Sheet, SheetHead, StateMark } from '@/features/catalogo/ledger';

export const backupsKey = ['backups'] as const;
export const BACKUP_POLL_MS = 2000;

const STATUS: Record<BackupStatus, { label: string; tone: Tone; shape: GlyphShape }> = {
  pending: { label: 'En proceso', tone: 'info', shape: 'half' },
  success: { label: 'Correcto', tone: 'ok', shape: 'filled' },
  failed: { label: 'Fallido', tone: 'danger', shape: 'struck' },
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
  return (
    <Sheet>
      <SheetHead title="Estado del sistema" />
      <div className="px-4 py-1">
        {q.isLoading ? (
          <div className="py-3">
            <Skeleton lines={4} />
          </div>
        ) : q.isError || !s ? (
          <p className="py-3 text-[13px] text-danger">{errorMessage(q.error, 'No se pudo consultar el estado.')}</p>
        ) : (
          <div className="flex flex-col">
            <LedgerFact label="Versión" labelWidth="sm">
              <span className="num">{s.version}</span>
            </LedgerFact>
            <LedgerFact label="Base de datos" labelWidth="sm">
              <StateMark shape="filled" tone="ok">
                {[DIALECT_LABEL[s.database.dialect] ?? s.database.dialect, s.database.server_version].filter(Boolean).join(' ') || 'Conectada'}
              </StateMark>
            </LedgerFact>
            <LedgerFact label="Migraciones" labelWidth="sm">
              {s.database.up_to_date === false ? (
                <StateMark shape="hollow" tone="warn">Pendientes</StateMark>
              ) : (
                <StateMark shape="filled" tone="ok">Al día</StateMark>
              )}
            </LedgerFact>
            <LedgerFact label="Espacio en disco" labelWidth="sm">
              {s.disk ? (
                <span className="num">
                  {formatBytes(s.disk.free_bytes)} libres de {formatBytes(s.disk.total_bytes)}
                </span>
              ) : (
                <Dash />
              )}
            </LedgerFact>
            <LedgerFact label="Último respaldo" labelWidth="sm">
              {s.backups.last_success ? <span className="num">{formatDateTime(s.backups.last_success.created_at)}</span> : 'Ninguno'}
            </LedgerFact>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function RestoreCard() {
  return (
    <Sheet>
      <SheetHead title="Restaurar un respaldo" />
      <div className="flex flex-col gap-2 px-4 py-3 text-[13px] leading-5 text-ink-2">
        <p>
          La restauración reemplaza toda la base de datos y la realiza <strong className="text-ink">soporte técnico</strong> en el servidor,
          con la aplicación detenida. No se hace desde el navegador.
        </p>
        <ol className="flex flex-col">
          {[
            'Descargue el respaldo y verifique su SHA-256.',
            'Detenga el servicio de la aplicación en el servidor.',
            'Restaure el archivo con la herramienta de soporte usando la clave de cifrado de respaldos.',
            'Inicie la aplicación y verifique el estado del sistema.',
          ].map((step, i) => (
            <li key={i} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2 border-b border-junta py-1.5 last:border-b-0">
              <span className="num font-semibold text-ink">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-[12px] text-ink-3">El procedimiento detallado está en la guía de soporte del servidor.</p>
      </div>
    </Sheet>
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
          <KpiGrid columns={3} aria-label="Resumen de respaldos">
            <KpiTile
              label="Último exitoso"
              tone={lastOk ? 'ok' : 'warn'}
              loading={q.isLoading}
              value={lastOk ? formatDateTime(lastOk.created_at) : 'Ninguno'}
              hint={lastOk ? `${formatBytes(lastOk.size_bytes)}, copia cifrada` : 'Cree un respaldo manual.'}
            />
            <KpiTile label="Respaldos registrados" loading={q.isLoading} value={backups.length} />
            <KpiTile label="Fallidos" tone={failed > 0 ? 'danger' : 'neutral'} loading={q.isLoading} value={failed} />
          </KpiGrid>
        )}
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          {canView ? (
            <Sheet>
              <SheetHead title="Historial" meta={<Count n={q.data?.length} one="respaldo" many="respaldos" />} />
              <DataTable
                caption="Historial de respaldos"
                rows={q.data}
                loading={q.isLoading}
                rowKey={(b) => b.id}
                density="compact"
                empty={<EmptyState compact icon={<Database />} title="Sin respaldos" description="Todavía no se ha creado ningún respaldo." />}
                columns={[
                  { key: 'date', header: 'Fecha', width: '170px', cell: (b) => <span className="num">{formatDateTime(b.created_at)}</span> },
                  { key: 'kind', header: 'Tipo', width: '120px', cell: (b) => (b.kind === 'scheduled' ? 'Automático' : 'Manual') },
                  { key: 'size', header: 'Tamaño', numeric: true, width: '110px', cell: (b) => (b.size_bytes == null ? <Dash /> : formatBytes(b.size_bytes)) },
                  {
                    key: 'status',
                    header: 'Estado',
                    width: '140px',
                    cell: (b) => (
                      <span title={b.error ?? undefined}>
                        <StateMark shape={STATUS[b.status].shape} tone={STATUS[b.status].tone}>
                          {STATUS[b.status].label}
                        </StateMark>
                      </span>
                    ),
                  },
                  {
                    key: 'sha',
                    header: 'SHA-256',
                    cell: (b) =>
                      b.sha256 ? (
                        <span className="num text-[12.5px] text-ink-2" title={b.sha256}>
                          {b.sha256.slice(0, 12)}…
                        </span>
                      ) : (
                        <Dash />
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
            </Sheet>
          ) : (
            <Sheet>
              <EmptyState compact icon={<HardDrive />} title="Historial no disponible" description="Su rol no incluye ver respaldos." />
            </Sheet>
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
