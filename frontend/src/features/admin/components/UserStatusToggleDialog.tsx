import { useEffect, useState } from 'react';

import { AdminDialog, AdminField } from '@/design-system/admin/components';
import type { AuthUser } from '@/lib/api';
import { DANGER_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON, TEXTAREA_CLASS } from '../adminUi';

type Props = {
  isToggling: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
  open: boolean;
  targetUser: AuthUser | null;
};

export function UserStatusToggleDialog({
  isToggling,
  onCancel,
  onConfirm,
  open,
  targetUser,
}: Props) {
  const [reason, setReason] = useState('');
  const requiresReason = Boolean(targetUser?.active);
  const reasonInvalid = requiresReason && reason.trim().length < 5;
  const deactivating = Boolean(targetUser?.active);

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  const title = deactivating ? 'Desactivar usuario?' : 'Activar usuario?';

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => { if (!next) onCancel(); }}
      title={title}
      description={deactivating ? (
        <>Al desactivar a <strong>{targetUser?.name}</strong>, no podrá iniciar sesión ni operar. Sus transacciones históricas permanecerán intactas.</>
      ) : (
        <>Al reactivar a <strong>{targetUser?.name}</strong>, recuperará el acceso operativo con sus credenciales habituales.</>
      )}
      footer={(
        <>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={isToggling} onClick={onCancel}>Cancelar</button>
          <button
            type="button"
            data-ui-press
            className={deactivating ? DANGER_BUTTON : PRIMARY_BUTTON}
            disabled={isToggling || reasonInvalid}
            onClick={() => onConfirm(requiresReason ? reason.trim() : null)}
          >
            {isToggling ? 'Cambiando…' : deactivating ? 'Desactivar' : 'Activar'}
          </button>
        </>
      )}
    >
      {requiresReason ? (
        <AdminField
          htmlFor="user-status-reason"
          label="Motivo"
          hint="Explique por qué se desactiva este usuario. Quedará registrado en auditoría."
          error={reason.length > 0 && reasonInvalid ? 'El motivo debe tener al menos 5 caracteres.' : undefined}
        >
          <textarea
            id="user-status-reason"
            aria-invalid={reason.length > 0 && reasonInvalid}
            value={reason}
            disabled={isToggling}
            onChange={(event) => setReason(event.target.value)}
            className={TEXTAREA_CLASS}
          />
        </AdminField>
      ) : null}
    </AdminDialog>
  );
}
