import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { AUDIT_RESULT_LABEL, type AuditLog, type AuditResult, type Paginated } from '@/api/types';
import { Badge, Button, Card, DataTable, Dialog, EmptyState, Field, Input, PageHeader, Select, type Tone } from '@/ui';

/** Spanish labels for common audit actions; unknown codes are shown as-is. */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Inicio de sesión',
  'auth.login_failed': 'Inicio de sesión fallido',
  'auth.logout': 'Cierre de sesión',
  'auth.password_changed': 'Cambio de contraseña',
  'cash.opened': 'Apertura de caja',
  'cash.closed': 'Cierre de caja',
  'invoice.issued': 'Emisión de factura',
  'invoice.voided': 'Anulación de factura',
  'invoice.reversed': 'Reversión de factura',
  'invoice.dialysis_denied': 'Receta de diálisis denegada',
  'payment.created': 'Cobro registrado',
  'payment.voided': 'Cobro anulado',
  'receipt.issued': 'Emisión de recibo',
  'receipt.reprinted': 'Reimpresión de recibo',
  'service.created': 'Concepto creado',
  'service.updated': 'Concepto modificado',
  'service.price_changed': 'Cambio de precio',
  'service.tax_changed': 'Cambio de impuesto',
  'service.availability_changed': 'Cambio de disponibilidad',
  'service.bulk_tax': 'Impuesto en lote',
  'service.imported': 'Importación de catálogo',
  'category.created': 'Categoría creada',
  'category.updated': 'Categoría modificada',
  'area.created': 'Área creada',
  'area.updated': 'Área modificada',
  'settings.updated': 'Ajustes modificados',
  'settings.rtn_changed': 'Cambio de RTN',
  'settings.logo_updated': 'Logo actualizado',
  'settings.logo_deleted': 'Logo eliminado',
  'fiscal_sequence.created': 'Numeración fiscal creada',
  'fiscal_sequence.updated': 'Numeración fiscal modificada',
  'tax_rate.created': 'Tasa de impuesto creada',
  'tax_rate.updated': 'Tasa de impuesto modificada',
  'tax_rate.deleted': 'Tasa de impuesto eliminada',
  'receipt_series.updated': 'Serie de recibo modificada',
  'print_profile.updated': 'Perfil de impresión modificado',
  'user.created': 'Usuario creado',
  'user.updated': 'Usuario modificado',
  'user.activated': 'Usuario activado',
  'user.deactivated': 'Usuario desactivado',
  'user.password_reset': 'Restablecimiento de clave',
  'role.created': 'Rol creado',
  'role.updated': 'Rol modificado',
  'backup.created': 'Respaldo creado',
  'backup.downloaded': 'Respaldo descargado',
  'backup.failed': 'Respaldo fallido',
};

export const actionLabel = (a: string) => AUDIT_ACTION_LABEL[a] ?? a;

const RESULT_TONE: Record<AuditResult, Tone> = { success: 'ok', failed: 'warn', denied: 'danger' };

export type AuditFilters = { search: string; action: string; date_from: string; date_to: string; page: number };

/** Query sent to GET /api/audit-logs (empty values are dropped by buildUrl). */
export function auditQuery(f: AuditFilters) {
  return { search: f.search.trim(), action: f.action, date_from: f.date_from, date_to: f.date_to, page: f.page, per_page: 25 };
}

function show(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'vacío';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function AuditDetail({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  const oldV = log?.old_values ?? {};
  const newV = log?.new_values ?? {};
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)])).sort();
  return (
    <Dialog open={log !== null} onClose={onClose} size="lg" title={log ? actionLabel(log.action) : ''} description={log ? formatDateTime(log.created_at) : undefined}>
      {log && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13px]">
            <dt className="text-ink-2">Responsable</dt>
            <dd>{log.user_name ?? '—'}</dd>
            <dt className="text-ink-2">Resultado</dt>
            <dd>
              <Badge tone={RESULT_TONE[log.result]} dot>
                {AUDIT_RESULT_LABEL[log.result]}
              </Badge>
            </dd>
            <dt className="text-ink-2">Registro</dt>
            <dd className="num">{log.entity_type ? `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}` : '—'}</dd>
            <dt className="text-ink-2">Motivo</dt>
            <dd>{log.reason ?? '—'}</dd>
            <dt className="text-ink-2">Dirección IP</dt>
            <dd className="num">{log.ip ?? '—'}</dd>
            <dt className="text-ink-2">Código</dt>
            <dd className="num text-ink-3">{log.action}</dd>
          </dl>
          {keys.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-line">
              <table className="w-full text-[13px]">
                <caption className="sr-only">Valores anteriores y nuevos</caption>
                <thead>
                  <tr className="border-b border-line bg-surface-2/60 text-left text-[12px] text-ink-2">
                    <th scope="col" className="px-3 py-2 font-medium">Campo</th>
                    <th scope="col" className="px-3 py-2 font-medium">Antes</th>
                    <th scope="col" className="px-3 py-2 font-medium">Después</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => {
                    const changed = show(oldV[k]) !== show(newV[k]);
                    return (
                      <tr key={k} className="border-b border-line align-top last:border-0">
                        <th scope="row" className="num px-3 py-2 text-left font-normal text-ink-2">{k}</th>
                        <td className={changed ? 'px-3 py-2 break-all text-danger line-through decoration-danger/40' : 'px-3 py-2 break-all text-ink-2'}>
                          {k in oldV ? show(oldV[k]) : '—'}
                        </td>
                        <td className={changed ? 'px-3 py-2 break-all font-medium text-ok' : 'px-3 py-2 break-all text-ink-2'}>
                          {k in newV ? show(newV[k]) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-ink-3">Este evento no registra cambios de valores.</p>
          )}
        </div>
      )}
    </Dialog>
  );
}

export default function AuditoriaPage() {
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search);
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const params = auditQuery({ search: deferred, action, date_from: dateFrom, date_to: dateTo, page });
  const q = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => api.get<Paginated<AuditLog>>('/audit-logs', params),
    placeholderData: (p) => p,
  });
  const filtered = Boolean(search || action || dateFrom || dateTo);
  const rangeError = dateFrom && dateTo && dateTo < dateFrom ? '"Hasta" debe ser igual o posterior a "Desde".' : null;
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <>
      <PageHeader eyebrow="Administración" title="Auditoría" description="Registro inalterable de las acciones sensibles del sistema." />
      <Card flush>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-3">
          <Field label="Usuario" className="w-full sm:w-60">
            <Input placeholder="Nombre o usuario" prefix={<Search />} value={search} onChange={(e) => reset(() => setSearch(e.target.value))} />
          </Field>
          <Field label="Acción" className="w-full sm:w-64">
            <Select
              value={action}
              onChange={(e) => reset(() => setAction(e.target.value))}
              placeholder="Todas las acciones"
              options={Object.entries(AUDIT_ACTION_LABEL)
                .map(([value, label]) => ({ value, label }))
                .sort((a, b) => a.label.localeCompare(b.label, 'es'))}
            />
          </Field>
          <Field label="Desde" className="w-40">
            <Input type="date" value={dateFrom} onChange={(e) => reset(() => setDateFrom(e.target.value))} />
          </Field>
          <Field label="Hasta" className="w-40" error={rangeError}>
            <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => reset(() => setDateTo(e.target.value))} />
          </Field>
          {filtered && (
            <Button
              variant="ghost"
              leftIcon={<X />}
              onClick={() =>
                reset(() => {
                  setSearch('');
                  setAction('');
                  setDateFrom('');
                  setDateTo('');
                })
              }
            >
              Limpiar filtros
            </Button>
          )}
        </div>
        <DataTable
          caption="Registro de auditoría"
          rows={q.data?.items}
          loading={q.isFetching}
          rowKey={(l) => l.id}
          onRowClick={setSelected}
          density="compact"
          empty={
            <EmptyState
              compact
              icon={<ScrollText />}
              title="Sin eventos"
              description={filtered ? 'No hay eventos que coincidan con los filtros.' : 'Todavía no hay eventos registrados.'}
            />
          }
          pagination={q.data ? { page: q.data.page, perPage: q.data.per_page, total: q.data.total, onPageChange: setPage } : undefined}
          columns={[
            { key: 'date', header: 'Fecha y hora', width: '150px', cell: (l) => <span className="tabular whitespace-nowrap">{formatDateTime(l.created_at)}</span> },
            { key: 'action', header: 'Acción', cell: (l) => <span className="font-medium">{actionLabel(l.action)}</span> },
            { key: 'user', header: 'Responsable', cell: (l) => l.user_name ?? <span className="text-ink-3">Sistema</span> },
            {
              key: 'result',
              header: 'Resultado',
              cell: (l) => (
                <Badge tone={RESULT_TONE[l.result]} dot>
                  {AUDIT_RESULT_LABEL[l.result]}
                </Badge>
              ),
            },
            {
              key: 'reason',
              header: 'Motivo',
              cell: (l) => (l.reason ? <span className="line-clamp-1 max-w-[360px] text-ink-2" title={l.reason}>{l.reason}</span> : <span className="text-ink-3">—</span>),
            },
          ]}
        />
      </Card>
      <AuditDetail log={selected} onClose={() => setSelected(null)} />
    </>
  );
}
