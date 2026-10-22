import { AdminCallout, AdminPageHeader } from '@/design-system/admin/components';
import { useAdminSession } from '@/shell/admin/AdminSessionContext';
import { CashBoxView } from '@/features/cash/CashBoxView';

/**
 * Caja "Panel administrativo".
 *
 * Delimita tres cosas que no son la misma:
 *  - caja física (gaveta/caja registradora),
 *  - usuario (quién opera),
 *  - sesión (turno abierto, propia o ajena).
 *
 * La vista delega la composición del turno en `CashBoxView`, que reúne la
 * identidad (caja/sesión/operador), el saldo y el trabajo de conciliación en
 * una sola superficie. Aquí solo vive el encabezado de página y el permiso de
 * nivel de módulo; la selección de caja física adicional no se dibuja porque
 * el contrato actual de `CashSession` no expone varias cajas habilitadas.
 */
export function CajaView() {
  const { user, has, cashSession, onStatus } = useAdminSession();
  const canViewCash = has('cash.view');
  const canOpenCash = has('cash.open');
  const canCloseAnyCash = has('cash.close_any');
  const canCloseCash = has('cash.close') || canCloseAnyCash;
  const canCreateInvoices = has('invoices.create');
  const canViewInvoices = has('invoices.view');
  const canViewCashSessionReport = has('reports.cash_session.view');

  return (
    <section aria-labelledby="caja-title" className="flex flex-col gap-5">
      <AdminPageHeader
        headingId="caja-title"
        title="Caja"
        description="Apertura, movimientos, arqueo y cierre del efectivo del turno."
      />

      {!canViewCash ? (
        <AdminCallout tone="error" title="Sin permiso de caja">
          Su rol no permite consultar ni operar caja. Solicite acceso a Caja a un administrador.
        </AdminCallout>
      ) : (
        <CashBoxView
          cashSession={cashSession}
          canCloseAnyCash={canCloseAnyCash}
          canCloseCash={canCloseCash}
          canCreateInvoices={canCreateInvoices}
          canOpenCash={canOpenCash}
          canViewCashSessionReport={canViewCashSessionReport}
          canViewInvoices={canViewInvoices}
          currentUserId={user.id}
          currentUserName={user.name}
          onStatus={onStatus}
        />
      )}
    </section>
  );
}
