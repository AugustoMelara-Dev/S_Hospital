import { type AuthUser } from '@/lib/api';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type UserStatusToggleDialogProps = {
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
}: UserStatusToggleDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={targetUser?.active ? 'Desactivar usuario?' : 'Activar usuario?'}
      confirmLabel={isToggling ? 'Cambiando...' : targetUser?.active ? 'Desactivar' : 'Activar'}
      confirmDisabled={isToggling}
      cancelDisabled={isToggling}
      danger={targetUser?.active}
      requireReasonTextarea={targetUser?.active}
      requireReasonMinLength={5}
      reasonHelpText="Explique por que se desactiva este usuario. Quedara registrado en auditoria."
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {targetUser?.active ? (
        <p>
          Al desactivar a <strong>{targetUser?.name}</strong>, este no podra iniciar sesion ni operar en el sistema. Las transacciones y reportes de caja historicos del usuario permaneceran intactos para fines de auditoria.
        </p>
      ) : (
        <p>
          Al reactivar a <strong>{targetUser?.name}</strong>, el usuario volvera a tener acceso operativo al sistema con sus credenciales habituales.
        </p>
      )}
    </ConfirmDialog>
  );
}