import { ReloadOutlined } from '@ant-design/icons';
import { Button, Tag } from 'antd';
import { Link } from 'react-router-dom';
import type { CashSession } from '@/lib/api';

type Props = { canCloseAnyCash: boolean; canCreateInvoices: boolean; isOwnSession: boolean; isLoading: boolean; onRefresh: () => void; session: CashSession | null };
export function CashSessionHeader({ canCloseAnyCash, canCreateInvoices, isOwnSession, isLoading, onRefresh, session }: Props) {
  const isOpen = session?.status === 'open';
  const cashier = session ? session.user?.name ?? session.user?.username ?? `Cajero #${session.user_id}` : null;
  return <header className="border-b border-border bg-background p-4 sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div><h1 className="text-2xl font-semibold">Caja</h1><p className="text-sm text-muted-foreground">Apertura, conciliación, movimientos auditados y cierre de efectivo.</p></div>
      <div className="flex flex-wrap gap-2">{isOpen && isOwnSession && canCreateInvoices ? <Link to="/billing/new"><Button type="primary">Nueva factura</Button></Link> : null}<Button icon={<ReloadOutlined spin={isLoading} />} onClick={onRefresh} disabled={isLoading}>Actualizar</Button></div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><Tag>{isOpen ? 'Caja abierta' : 'Caja cerrada'}</Tag><p role="status" aria-live="polite">{isLoading ? 'Actualizando estado de caja.' : isOpen && session ? `Abierta ${formatLocalDateTime(session.opened_at)}` : 'No hay una caja abierta actualmente.'}</p>{isOpen && cashier ? <p><strong>{cashier}</strong> · {isOwnSession ? 'Caja propia' : canCloseAnyCash ? 'Supervisión habilitada' : 'Sesión de otro cajero'}</p> : null}</div>
  </header>;
}
function formatLocalDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'en hora no disponible' : new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date); }
