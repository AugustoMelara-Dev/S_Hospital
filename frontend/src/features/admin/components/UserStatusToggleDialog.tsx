import { useEffect, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import type { AuthUser } from '@/lib/api';

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

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  const title = targetUser?.active ? 'Desactivar usuario?' : 'Activar usuario?';

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {targetUser?.active ? (
              <>
                Al desactivar a <strong>{targetUser.name}</strong>, no podrá iniciar sesión ni operar. Sus
                transacciones históricas permanecerán intactas.
              </>
            ) : (
              <>
                Al reactivar a <strong>{targetUser?.name}</strong>, recuperará el acceso operativo con sus
                credenciales habituales.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requiresReason ? (
          <Field data-invalid={reason.length > 0 && reasonInvalid}>
            <FieldLabel htmlFor="user-status-reason">Motivo</FieldLabel>
            <Textarea
              id="user-status-reason"
              aria-label="Motivo"
              aria-invalid={reason.length > 0 && reasonInvalid}
              value={reason}
              disabled={isToggling}
              onChange={(event) => setReason(event.target.value)}
            />
            <FieldDescription>
              Explique por qué se desactiva este usuario. Quedará registrado en auditoría.
            </FieldDescription>
            {reason.length > 0 && reasonInvalid ? (
              <FieldError>El motivo debe tener al menos 5 caracteres.</FieldError>
            ) : null}
          </Field>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isToggling}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant={targetUser?.active ? 'destructive' : 'default'}
            disabled={isToggling || reasonInvalid}
            onClick={() => onConfirm(requiresReason ? reason.trim() : null)}
          >
            {isToggling ? <Spinner data-icon="inline-start" /> : null}
            {isToggling ? 'Cambiando…' : targetUser?.active ? 'Desactivar' : 'Activar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
