import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from './ThemeProvider';

/*
 * Contrato post-2026-10-16 (dark único, IDENTIDAD_DARK_20261016): el tema ya no
 * se persiste ni se alterna. `html.dark` debe quedar SIEMPRE —incluso si un
 * generación anterior dejó 'light' en localStorage— y los hijos renderizan.
 */
describe('ThemeProvider (dark único)', () => {
  it('fija siempre la clase dark y renderiza los hijos', () => {
    localStorage.setItem('hospital-billing-theme', 'light');

    render(
      <ThemeProvider>
        <span>Contenido</span>
      </ThemeProvider>,
    );

    expect(screen.getByText('Contenido')).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('repone la clase dark si un polyfill o herencia la quito', () => {
    document.documentElement.classList.remove('dark');

    render(<ThemeProvider><span>Contenido</span></ThemeProvider>);

    expect(document.documentElement).toHaveClass('dark');
  });
});
