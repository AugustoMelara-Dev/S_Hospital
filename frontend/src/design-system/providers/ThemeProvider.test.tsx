import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from './ThemeProvider';

describe('ThemeProvider', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('applies the persisted local theme without an external provider', async () => {
    localStorage.setItem('hospital-billing-theme', 'dark');
    render(<ThemeProvider><span>Contenido</span></ThemeProvider>);

    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  });
});
