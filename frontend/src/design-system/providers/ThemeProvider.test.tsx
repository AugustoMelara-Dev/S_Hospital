import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from './ThemeProvider';

/* El tema claro prevalece sobre preferencias oscuras heredadas. */
describe('ThemeProvider (claro hospitalario)', () => {
  it('elimina la clase dark heredada y renderiza los hijos', () => {
    localStorage.setItem('hospital-billing-theme', 'dark');
    document.documentElement.classList.add('dark');

    render(
      <ThemeProvider>
        <span>Contenido</span>
      </ThemeProvider>,
    );

    expect(screen.getByText('Contenido')).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('mantiene el tema claro sin una preferencia almacenada', () => {
    document.documentElement.classList.remove('dark');

    render(<ThemeProvider><span>Contenido</span></ThemeProvider>);

    expect(document.documentElement).not.toHaveClass('dark');
  });
});
