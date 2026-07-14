import { useEffect, useState } from 'react';
import { Form, Input, Modal } from 'antd';
import { type AuthUser } from '@/lib/api';

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
  const [reason, setReason] = useState('');
  const requiresReason = Boolean(targetUser?.active);
  const reasonInvalid = requiresReason && reason.trim().length < 5;

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  return (
    <Modal
      open={open}
      title={targetUser?.active ? 'Desactivar usuario?' : 'Activar usuario?'}
      okText={isToggling ? 'Cambiando...' : targetUser?.active ? 'Desactivar' : 'Activar'}
      cancelText="Cancelar"
      okButtonProps={{ disabled: isToggling || reasonInvalid, danger: Boolean(targetUser?.active) }}
      cancelButtonProps={{ disabled: isToggling }}
      onCancel={onCancel}
      onOk={() => onConfirm(requiresReason ? reason.trim() : null)}
      modalRender={(node) => <div role="alertdialog" aria-label={targetUser?.active ? 'Desactivar usuario?' : 'Activar usuario?'}>{node}</div>}
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
      {requiresReason ? <Form.Item
        label="Motivo"
        htmlFor="user-status-reason"
        required
        validateStatus={reason.length > 0 && reasonInvalid ? 'error' : undefined}
        help={reason.length > 0 && reasonInvalid ? 'El motivo debe tener al menos 5 caracteres.' : 'Explique por que se desactiva este usuario. Quedara registrado en auditoria.'}
      >
        <Input.TextArea id="user-status-reason" aria-label="Motivo" value={reason} disabled={isToggling} onChange={(event) => setReason(event.target.value)} />
      </Form.Item> : null}
    </Modal>
  );
}
