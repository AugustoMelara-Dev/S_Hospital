import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

function setReasonValue(textarea: HTMLElement, value: string) {
  fireEvent.change(textarea, { target: { value } });
}

describe('ConfirmDialog with reason', () => {
  it('does not call onConfirm until the reason meets the minimum length', async () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Anular factura"
        confirmLabel="Anular"
        requireReasonTextarea
        requireReasonMinLength={5}
        onCancel={() => {}}
        onConfirm={onConfirm}
      >
        Esta accion es irreversible.
      </ConfirmDialog>,
    );

    const confirm = screen.getByRole('button', { name: /anular/i });
    expect(confirm).toBeDisabled();

    const textarea = screen.getByRole('textbox', { name: /motivo/i });

    setReasonValue(textarea, 'cort');
    await waitFor(() => expect(confirm).toBeDisabled());

    setReasonValue(textarea, 'Error de digitacion autorizado por supervision.');
    await waitFor(() => expect(confirm).not.toBeDisabled());

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('Error de digitacion autorizado por supervision.');
  });

  it('still confirms without reason when not required', () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Cerrar sesion"
        confirmLabel="Salir"
        onCancel={() => {}}
        onConfirm={onConfirm}
      >
        Confirme para salir.
      </ConfirmDialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: /salir/i }));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('shows accessible error when reason is too short', async () => {
    render(
      <ConfirmDialog
        open
        title="Cerrar caja"
        confirmLabel="Cerrar"
        requireReasonTextarea
        requireReasonMinLength={10}
        onCancel={() => {}}
        onConfirm={() => {}}
      >
        Detalle la diferencia.
      </ConfirmDialog>,
    );

    const textarea = screen.getByRole('textbox', { name: /motivo/i });
    setReasonValue(textarea, 'corto');
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/al menos 10 caracteres/i);
    });
  });
});
