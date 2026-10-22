import { AdminDialog } from '@/design-system/admin/components';
import type { AuthUser } from '@/lib/api';
import { roleLabel } from '@/lib/role-labels';

export function UserDetailDialog({ onOpenChange, user }: { onOpenChange: (open: boolean) => void; user: AuthUser | null }) {
  return (
    <AdminDialog
      open={user !== null}
      onOpenChange={onOpenChange}
      className="sm:max-w-2xl"
      title="Detalle de usuario"
      description="Cuenta, acceso operativo y estado actual."
    >
      {user ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-4 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-4">
            <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] text-[length:var(--ui-text-lg)] font-semibold text-[color:var(--ui-ink)]">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-semibold [overflow-wrap:anywhere] break-words text-[color:var(--ui-ink)]">{user.name}</p>
              <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)] [overflow-wrap:anywhere] break-words">{user.email}</p>
            </div>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail label="Usuario de acceso"><span className="font-mono">{user.username}</span></Detail>
            <Detail label="Estado">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={user.active ? 'size-2 rounded-full bg-[var(--ui-success)]' : 'size-2 rounded-full bg-[var(--ui-line-strong)]'} />
                {user.active ? 'Activo' : 'Inactivo'}
              </span>
            </Detail>
            <Detail label="Roles operativos" wide>
              <div className="flex flex-wrap gap-2">
                {user.roles.length
                  ? user.roles.map((role) => <span key={role} className="inline-flex items-center rounded-[var(--ui-radius)] border border-[var(--ui-line-strong)] px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-ink-soft)]">{roleLabel(role)}</span>)
                  : <span className="text-[color:var(--ui-ink-soft)]">Sin rol asignado</span>}
              </div>
            </Detail>
            <Detail label="Acceso efectivo" wide>
              <p>{user.permissions.length} permiso{user.permissions.length === 1 ? '' : 's'} habilitado{user.permissions.length === 1 ? '' : 's'} para esta cuenta.</p>
              {user.must_change_password ? <p className="mt-2 font-medium text-[color:var(--ui-warn)]">Debe cambiar su contraseña en el próximo ingreso.</p> : null}
            </Detail>
          </dl>
        </div>
      ) : null}
    </AdminDialog>
  );
}

function Detail({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? 'rounded-[var(--ui-radius)] border border-[var(--ui-line)] p-4 sm:col-span-2' : 'rounded-[var(--ui-radius)] border border-[var(--ui-line)] p-4'}>
      <dt className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">{label}</dt>
      <dd className="mt-1 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)]">{children}</dd>
    </div>
  );
}
