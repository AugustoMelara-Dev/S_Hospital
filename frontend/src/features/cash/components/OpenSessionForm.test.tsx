import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpenSessionForm } from './OpenSessionForm';

const registers = [
  { id: 1, code: 'C1', name: 'Caja principal', active: true },
  { id: 2, code: 'C2', name: 'Caja emergencia', active: true },
];

describe('OpenSessionForm selection', () => {
  it('blocks a selected register that is removed while the list refreshes', async () => {
    const onSubmit = vi.fn();
    const view = render(<OpenSessionForm cashRegisters={registers} isSubmitting={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/caja física/i), { target: { value: '1' } });
    view.rerender(<OpenSessionForm cashRegisters={[registers[1], { ...registers[1], id: 3, code: 'C3', name: 'Caja nueva' }]} isSubmitting={false} onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByRole('button', { name: 'Abrir caja' }).closest('form')!);
    expect(await screen.findByText('Seleccione una caja habilitada de la lista actual.')).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks an inactive register even if its id remains in the supplied list', async () => {
    const onSubmit = vi.fn();
    render(<OpenSessionForm cashRegisters={[{ ...registers[0], active: false }]} isSubmitting={false} onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByRole('button', { name: 'Abrir caja' }).closest('form')!);
    expect(await screen.findByText('Seleccione una caja habilitada de la lista actual.')).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits an active current register and the entered opening amount', async () => {
    const onSubmit = vi.fn();
    render(<OpenSessionForm cashRegisters={registers} isSubmitting={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/caja física/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/monto inicial/i), { target: { value: '75.25' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Abrir caja' }).closest('form')!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ cash_register_id: 2, opening_amount: '75.25' }));
  });
});
