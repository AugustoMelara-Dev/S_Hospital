import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureAxe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { PasswordChangeView } from './PasswordChangeView';

const axe = configureAxe({ rules: { 'color-contrast': { enabled: false } } });

function renderView(onSubmit = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <PasswordChangeView onSubmit={onSubmit} />
    </QueryClientProvider>,
  );
}

describe('PasswordChangeView', () => {
  it('comparte el AuthLayout y ofrece los requisitos bajo demanda', async () => {
    const user = userEvent.setup();
    const { container } = renderView();

    expect(screen.getByRole('heading', { name: 'Proteja su cuenta' })).toBeVisible();
    expect(container.querySelector('.ui-root')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="card"]')).not.toBeInTheDocument();

    // Los requisitos existen una sola vez y se revelan al abrir el detalle
    // accesible; antes se repetían en un panel lateral y en el formulario.
    const summary = screen.getByText('Qué debe incluir la contraseña');
    expect(screen.queryByText(/mínimo 12 caracteres/i)).not.toBeVisible();

    await user.click(summary);

    expect(screen.getByText(/mínimo 12 caracteres/i)).toBeVisible();
    expect(screen.getByText(/mayúscula, minúscula, número y símbolo/i)).toBeVisible();
  });

  it('muestra el error de confirmación cuando las contraseñas no coinciden', async () => {
    const user = userEvent.setup();
    renderView();
    await user.type(screen.getByLabelText(/^contraseña actual/i), 'ClaveActual1!');
    await user.type(screen.getByLabelText(/^nueva contraseña/i), 'NuevaClave123!');
    await user.type(screen.getByLabelText(/^confirmar nueva contraseña/i), 'OtraClave123!');
    await user.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    expect(await screen.findByText('Las contraseñas no coinciden')).toBeVisible();
  });

  it('envía los tres campos cuando la contraseña es válida', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderView(onSubmit);
    await user.type(screen.getByLabelText(/^contraseña actual/i), 'ClaveActual1!');
    await user.type(screen.getByLabelText(/^nueva contraseña/i), 'NuevaClave123!');
    await user.type(screen.getByLabelText(/^confirmar nueva contraseña/i), 'NuevaClave123!');
    await user.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      current_password: 'ClaveActual1!', password: 'NuevaClave123!', password_confirmation: 'NuevaClave123!',
    }, expect.anything()));
  });

  it('no presenta violaciones axe en el estado inicial', async () => {
    const { container } = renderView();
    expect(await axe(container)).toHaveNoViolations();
  });
});
