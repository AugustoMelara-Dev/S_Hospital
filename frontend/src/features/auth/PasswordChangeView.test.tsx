import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureAxe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { PasswordChangeView } from './PasswordChangeView';

const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

describe('PasswordChangeView', () => {
  it('presenta los requisitos antes de los campos sin una Card contenedora', () => {
    const { container } = render(<PasswordChangeView onSubmit={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Cambio obligatorio de contraseña' })).toBeVisible();
    expect(screen.getByText(/mínimo 12 caracteres/i)).toBeVisible();
    expect(screen.getByText(/mayúscula, minúscula, número y símbolo/i)).toBeVisible();
    expect(container.querySelector('[data-slot="card"]')).not.toBeInTheDocument();
  });

  it('muestra el error de confirmación cuando las contraseñas no coinciden', async () => {
    render(<PasswordChangeView onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'ClaveActual1!' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'NuevaClave123!' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'OtraClave123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeVisible();
  });

  it('envía los tres campos cuando la contraseña es válida', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PasswordChangeView onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'ClaveActual1!' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'NuevaClave123!' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'NuevaClave123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        {
          current_password: 'ClaveActual1!',
          password: 'NuevaClave123!',
          password_confirmation: 'NuevaClave123!',
        },
        expect.anything(),
      );
    });
  });

  it('no presenta violaciones axe en el estado inicial', async () => {
    const { container } = render(<PasswordChangeView onSubmit={vi.fn()} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
