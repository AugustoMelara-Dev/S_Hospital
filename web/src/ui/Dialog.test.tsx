import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { Dialog } from './Dialog';

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Confirmar cobro" footer={<Button>Aceptar</Button>}>
        <input aria-label="Referencia" />
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('focuses inside, traps Tab, closes on Esc and returns focus', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Abrir' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Confirmar cobro' });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    // Tab cycles within the dialog.
    for (let i = 0; i < 5; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('requires a reason of at least 5 characters', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        title="Anular factura"
        description="Esta acción no se puede deshacer."
        tone="danger"
        confirmLabel="Anular"
        reason={{ label: 'Motivo de anulación' }}
        onConfirm={onConfirm}
      />,
    );
    const confirm = screen.getByRole('button', { name: 'Anular' });
    await user.type(screen.getByLabelText(/Motivo de anulación/), 'abc');
    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Escriba un motivo de al menos 5 caracteres.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo de anulación/)).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText(/Motivo de anulación/), ' error de digitación');
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('abc error de digitación');
  });
});
