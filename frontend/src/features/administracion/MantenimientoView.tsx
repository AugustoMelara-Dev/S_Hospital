import { AdminChip } from '@/design-system/admin/components';
import { useAdminSession } from '@/shell/admin/AdminSessionContext';
import { BackupsView } from '@/features/backups/BackupsView';

/**
 * Mantenimiento mínimo "Panel administrativo".
 *
 * Una banda corta separa el mantenimiento del trabajo cotidiano y presenta el
 * estado real de los respaldos. Distingue la integridad del archivo de una
 * restauración comprobada. Un estado desconocido se muestra como no verificado.
 */
export function MantenimientoView() {
  const { user, onStatus } = useAdminSession();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-[var(--ui-line)] pb-3">
        <AdminChip tone="neutral">Mantenimiento</AdminChip>
        <span className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
          Revise las copias disponibles y conserve una descarga reciente fuera del equipo servidor.
        </span>
      </div>
      <BackupsView user={user} onStatus={onStatus} />
    </div>
  );
}
