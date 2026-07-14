import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { configureAxe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { LoginView } from './LoginView';

const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

vi.mock('../../hooks/useFiscalSettings', () => ({
  usePublicBranding: () => ({
    data: {
      hospital_name: 'Hospital San Isidro',
      rtn: '08011999123456',
    },
  }),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginView
        login=""
        password=""
        status="Listo para iniciar sesión."
        onLoginChange={vi.fn()}
        onPasswordChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('LoginView accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has no axe-core violations on the default render', async () => {
    const { container } = renderLogin();

    expect(await axe(container)).toHaveNoViolations();
  });

  it('exposes the username and password inputs as labeled controls', () => {
    renderLogin();

    const loginInput = screen.getByLabelText(/usuario|correo/i);
    const passwordInput = screen.getByLabelText(/^contrase/i);

    expect(loginInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  it('keeps the submit button reachable from keyboard navigation', () => {
    renderLogin();

    const button = screen.getByRole('button', { name: /ingresar|iniciar/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });
});
