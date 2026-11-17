import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/dates';
import { AUDIT_RESULT_LABEL, type AuditLog, type AuditResult, type Paginated } from '@/api/types';
import { Button, DataTable, Drawer, EmptyState, Field, Input, PageHeader, Select, type GlyphShape, type Tone } from '@/ui';
import { Count, Dash, LedgerFact, LedgerSection, Sheet, StateMark, Toolbar } from '@/features/catalogo/ledger';

/** Labels for every action code the backend writes (`audit(...)` calls in api/app). */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Inicio de sesión',
  'auth.logout': 'Cierre de sesión',
  'auth.password_changed': 'Cambio de contraseña',
  'cash.opened': 'Apertura de caja',
  'cash.closed': 'Cierre de caja',
  'invoice.issued': 'Emisión de factura',
  'invoice.voided': 'Anulación de factura',
  'invoice.reversed': 'Reversión de factura',
  'payment.created': 'Cobro registrado',
  'receipt.issued': 'Emisión de recibo',
  'receipt.printed': 'Impresión de recibo',
  'receipt.reprinted': 'Reimpresión de recibo',
  'receipt.test_printed': 'Impresión de prueba',
  'report.exported': 'Reporte exportado',
  'service.created': 'Concepto creado',
  'service.updated': 'Concepto modificado',
  'service.price_changed': 'Cambio de precio',
  'service.tax_changed': 'Cambio de impuesto',
  'service.availability_changed': 'Cambio de disponibilidad',
  'service.bulk_tax_changed': 'Impuesto en lote',
  'catalog.imported': 'Importación de catálogo',
  'category.created': 'Categoría creada',
  'category.updated': 'Categoría modificada',
  'category.availability_changed': 'Categoría activada o desactivada',
  'area.created': 'Área creada',
  'area.updated': 'Área modificada',
  'area.availability_changed': 'Área activada o desactivada',
  'settings.updated': 'Ajustes modificados',
  'settings.rtn_changed': 'Cambio de RTN',
  'settings.logo_updated': 'Logo actualizado',
  'settings.logo_deleted': 'Logo eliminado',
  'fiscal_sequence.created': 'Numeración fiscal creada',
  'fiscal_sequence.updated': 'Numeración fiscal modificada',
  'tax_rate.created': 'Tasa de impuesto creada',
  'tax_rate.updated': 'Tasa de impuesto modificada',
  'tax_rate.deleted': 'Tasa de impuesto eliminada',
  'receipt_series.created': 'Serie de recibo creada',
  'receipt_series.updated': 'Serie de recibo modificada',
  'print_profile.updated': 'Perfil de impresión modificado',
  'user.created': 'Usuario creado',
  'user.updated': 'Usuario modificado',
  'user.role_changed': 'Cambio de rol de usuario',
  'user.activated': 'Usuario activado',
  'user.deactivated': 'Usuario desactivado',
  'user.password_reset': 'Restablecimiento de clave',
  'role.created': 'Rol creado',
  'role.updated': 'Rol modificado',
  'backup.requested': 'Respaldo solicitado',
  'backup.completed': 'Respaldo completado',
  'backup.failed': 'Respaldo fallido',
  'backup.downloaded': 'Respaldo descargado',
  'backup.pruned': 'Respaldos antiguos depurados',
};

export const actionLabel = (a: string) => AUDIT_ACTION_LABEL[a] ?? a;

/** Filter label beside its control, one toolbar row. */
const INLINE = 'flex-row items-center gap-2';

const RESULT_TONE: Record<AuditResult, Tone> = { success: 'ok', failed: 'warn', denied: 'danger' };
const RESULT_SHAPE: Record<AuditResult, GlyphShape> = { success: 'filled', failed: 'half', denied: 'struck' };

function ResultMark({ result }: { result: AuditResult }) {
  return (
    <StateMark shape={RESULT_SHAPE[result]} tone={RESULT_TONE[result]}>
      {AUDIT_RESULT_LABEL[result]}
    </StateMark>
  );
}

const entityOf = (log: AuditLog) => (log.entity_type ? `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}` : null);

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
  const changedCount = keys.filter((k) => show(oldV[k]) !== show(newV[k])).length;
  return (
    <Drawer
      open={log !== null}
      onClose={onClose}
      width="lg"
      title={log ? actionLabel(log.action) : ''}
      description={log ? <span className="num">{formatDateTime(log.created_at)}</span> : undefined}
      footer={<Button onClick={onClose}>Cerrar</Button>}
    >
      {log && (
        <div className="flex flex-col">
          <LedgerSection title="Evento">
            <LedgerFact label="Responsable" labelWidth="sm">
              {log.user_name ?? <span className="text-ink-2">Sistema</span>}
              {log.username && <span className="num ml-2 text-[12.5px] text-ink-3">{log.username}</span>}
            </LedgerFact>
            <LedgerFact label="Resultado" labelWidth="sm">
              <ResultMark result={log.result} />
            </LedgerFact>
            <LedgerFact label="Registro" labelWidth="sm">
              {entityOf(log) ? <span className="num">{entityOf(log)}</span> : <Dash />}
            </LedgerFact>
            <LedgerFact label="Motivo" labelWidth="sm">
              {log.reason ?? <Dash />}
            </LedgerFact>
            <LedgerFact label="Dirección IP" labelWidth="sm">
              {log.ip ? <span className="num">{log.ip}</span> : <Dash />}
            </LedgerFact>
            <LedgerFact label="Código" labelWidth="sm">
              <span className="num text-ink-2">{log.action}</span>
            </LedgerFact>
          </LedgerSection>
          <LedgerSection
            title="Cambios"
            aside={keys.length > 0 ? `${changedCount} de ${keys.length} ${keys.length === 1 ? 'campo' : 'campos'} cambiaron` : undefined}
          >
            {keys.length > 0 ? (
              <div className="mt-2 overflow-hidden rounded-[var(--radius-sm)] border border-junta">
                <table className="w-full border-collapse text-[13px] leading-5">
                  <caption className="sr-only">Valores anteriores y nuevos</caption>
                  <thead>
                    <tr className="bg-ground text-left text-[12px] text-ink-2">
                      <th scope="col" className="h-8 w-[30%] border-b border-junta px-3 font-semibold">Campo</th>
                      <th scope="col" className="h-8 border-b border-l border-junta px-3 font-semibold">Antes</th>
                      <th scope="col" className="h-8 border-b border-l border-junta px-3 font-semibold">Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => {
                      const changed = show(oldV[k]) !== show(newV[k]);
                      return (
                        <tr key={k} className="align-top [&:last-child>*]:border-b-0">
                          <th scope="row" className={cn('num border-b border-junta px-3 py-2 text-left font-normal', changed ? 'font-semibold text-ink' : 'text-ink-2')}>
                            {k}
                          </th>
                          <td
                            className={cn(
                              'num border-b border-l border-junta px-3 py-2 break-all',
                              changed ? 'bg-danger-soft text-danger line-through decoration-danger/50' : 'text-ink-2',
                            )}
                          >
                            {k in oldV ? show(oldV[k]) : '—'}
                          </td>
                          <td className={cn('num border-b border-l border-junta px-3 py-2 break-all', changed ? 'bg-ok-soft font-semibold text-ok' : 'text-ink-2')}>
                            {k in newV ? show(newV[k]) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-2.5 text-[13px] text-ink-2">Este evento no registra cambios de valores.</p>
            )}
          </LedgerSection>
        </div>
      )}
    </Drawer>
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
      <PageHeader title="Auditoría" description="Registro inalterable de las acciones sensibles del sistema." className="pb-3" />
      <Sheet>
        <Toolbar className="gap-x-4">
          <Field label="Usuario" className={INLINE}>
            <Input placeholder="Nombre o usuario" prefix={<Search />} value={search} onChange={(e) => reset(() => setSearch(e.target.value))} wrapperClassName="w-56" />
          </Field>
          <Field label="Acción" className={INLINE}>
            <Select
              value={action}
              onChange={(e) => reset(() => setAction(e.target.value))}
              placeholder="Todas las acciones"
              options={Object.entries(AUDIT_ACTION_LABEL)
                .map(([value, label]) => ({ value, label }))
                .sort((a, b) => a.label.localeCompare(b.label, 'es'))}
              wrapperClassName="w-60"
            />
          </Field>
          <Field label="Desde" className={INLINE}>
            <Input className="w-40" type="date" value={dateFrom} onChange={(e) => reset(() => setDateFrom(e.target.value))} />
          </Field>
          <Field label="Hasta" className={INLINE} error={rangeError}>
            <Input className="w-40" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => reset(() => setDateTo(e.target.value))} />
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
          <span className="ml-auto">
            <Count n={q.data?.total} one="evento" many="eventos" />
          </span>
        </Toolbar>
        <DataTable
          caption="Registro de auditoría"
          rows={q.data?.items}
          loading={q.isFetching}
          rowKey={(l) => l.id}
          onRowClick={setSelected}
          isRowSelected={(l) => selected?.id === l.id}
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
            { key: 'date', header: 'Fecha y hora', width: '150px', cell: (l) => <span className="num whitespace-nowrap">{formatDateTime(l.created_at)}</span> },
            { key: 'action', header: 'Acción', width: '240px', cell: (l) => <span className="font-medium">{actionLabel(l.action)}</span> },
            { key: 'user', header: 'Responsable', width: '190px', cell: (l) => l.user_name ?? <span className="text-ink-2">Sistema</span> },
            {
              key: 'entity',
              header: 'Registro',
              width: '150px',
              cell: (l) => (entityOf(l) ? <span className="num text-[13px] text-ink-2">{entityOf(l)}</span> : <Dash />),
            },
            { key: 'result', header: 'Resultado', width: '130px', cell: (l) => <ResultMark result={l.result} /> },
            {
              key: 'reason',
              header: 'Motivo',
              cell: (l) =>
                l.reason ? (
                  <span className="line-clamp-1 text-ink-2" title={l.reason}>
                    {l.reason}
                  </span>
                ) : (
                  <Dash />
                ),
            },
          ]}
        />
      </Sheet>
      <AuditDetail log={selected} onClose={() => setSelected(null)} />
    </>
  );
}
