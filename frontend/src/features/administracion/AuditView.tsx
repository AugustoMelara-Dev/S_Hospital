import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { system } from '@/lib/api';
import type { AuditLogEntry } from '@/lib/api/types';
import type { AuditLogFilters } from '@/lib/api/system';
import { formatDateTime } from '@/lib/format/formatDate';
import { AdminCallout, AdminEmpty, AdminField, AdminPageHeader, AdminPanel, AdminTable, type AdminColumn } from '@/design-system/admin/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ACTIONS: Record<string, string> = {
  'invoice.voided': 'Anulación de operación',
  'invoice.void_blocked_paid': 'Anulación bloqueada por pago',
  'invoice.reversed': 'Reversión de operación',
  'invoice.reprinted': 'Reimpresión',
  'service.price_updated': 'Cambio de precio',
  'service.created': 'Producto o servicio agregado',
  'service.updated': 'Producto o servicio actualizado',
  'cash_session.opened': 'Apertura de caja',
  'cash_session.closed': 'Cierre de caja',
  'auth.login': 'Inicio de sesión',
  'auth.logout': 'Cierre de sesión',
};
const RESULTS: Record<string, string> = { success: 'Correcto', failed: 'Fallido', denied: 'Denegado', blocked: 'Bloqueado', error: 'Error' };
const columns: AdminColumn<AuditLogEntry>[] = [
  { key: 'date', header: 'Fecha y hora', cell: (row) => formatDateTime(row.created_at) },
  { key: 'action', header: 'Acción', mobilePrimary: true, cell: (row) => ACTIONS[row.action] ?? 'Otra actividad registrada' },
  { key: 'user', header: 'Responsable', mobilePrimary: true, cell: (row) => row.user ? <span><span>{row.user.name}</span><span className="block text-[color:var(--ui-ink-soft)]">{row.user.username}</span></span> : 'Sistema o usuario no disponible' },
  { key: 'result', header: 'Resultado', cell: (row) => row.result ? RESULTS[row.result] ?? 'Registrado' : 'Sin resultado informado' },
  { key: 'reason', header: 'Motivo', cell: (row) => <span className="whitespace-normal break-words">{row.reason || 'Sin motivo registrado'}</span> },
];

/** Historial de sólo lectura; la API autoriza audit.view y pagina todos los resultados. */
export function AuditView() {
  const [draft, setDraft] = useState({ user: '', action: '', from: '', to: '' });
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, per_page: 25 });
  const query = useQuery({ queryKey: ['system', 'audit-logs', filters], queryFn: () => system.getAuditLogs(filters) });
  const total = query.data?.meta.total ?? 0;
  const page = query.data?.meta.current_page ?? filters.page ?? 1;
  const lastPage = Math.max(1, Math.ceil(total / (query.data?.meta.per_page ?? 25)));
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ user: draft.user.trim() || undefined, action: draft.action || undefined, from: draft.from || undefined, to: draft.to || undefined, page: 1, per_page: 25 });
  };
  return (
    <section aria-labelledby="audit-title" className="flex min-w-0 flex-col gap-4">
      <AdminPageHeader headingId="audit-title" title="Auditoría" description="Responsables, resultados y motivos de las operaciones. Historial de sólo lectura." />
      <AdminPanel className="p-4">
        <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AdminField htmlFor="audit-user" label="Nombre o usuario"><Input id="audit-user" maxLength={120} value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} /></AdminField>
          <AdminField htmlFor="audit-action" label="Acción"><select id="audit-action" className="h-9 w-full rounded-lg border border-[var(--ui-line)] bg-[var(--ui-surface)] px-3 text-sm text-[color:var(--ui-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}><option value="">Todas las acciones</option>{Object.entries(ACTIONS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></AdminField>
          <AdminField htmlFor="audit-from" label="Desde"><Input id="audit-from" type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></AdminField>
          <AdminField htmlFor="audit-to" label="Hasta"><Input id="audit-to" type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></AdminField>
          <div className="flex items-end gap-2"><Button type="submit" disabled={query.isFetching}>Aplicar filtros</Button><Button type="button" variant="outline" disabled={query.isFetching} onClick={() => { setDraft({ user: '', action: '', from: '', to: '' }); setFilters({ page: 1, per_page: 25 }); }}>Limpiar</Button></div>
        </form>
      </AdminPanel>
      {query.isPending ? <p role="status">Cargando auditoría…</p> : query.isError ? <AdminCallout tone="error" title="No se pudo cargar la auditoría"><div role="alert">Revise la conexión con el servidor y vuelva a intentar.</div><Button type="button" variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></AdminCallout> : <AdminPanel>
        <AdminTable columns={columns} rows={query.data.data} getRowKey={(row) => String(row.id)} caption="Eventos de auditoría" empty={<AdminEmpty title="Sin eventos para estos filtros" description="Amplíe las fechas o limpie los filtros para revisar otra actividad." />} />
      </AdminPanel>}
      <nav aria-label="Páginas de auditoría" className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-[color:var(--ui-ink-soft)]">{total} eventos · Página {page} de {lastPage}</p>
        <div className="flex gap-2"><Button type="button" variant="outline" aria-label="Página anterior" disabled={query.isFetching || query.isError || page <= 1} onClick={() => setFilters({ ...filters, page: page - 1 })}>Anterior</Button><Button type="button" variant="outline" aria-label="Página siguiente" disabled={query.isFetching || query.isError || page >= lastPage} onClick={() => setFilters({ ...filters, page: page + 1 })}>Siguiente</Button></div>
      </nav>
    </section>
  );
}
