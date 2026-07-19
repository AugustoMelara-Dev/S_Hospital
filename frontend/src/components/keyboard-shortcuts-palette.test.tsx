import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KeyboardShortcutsPalette } from './keyboard-shortcuts-palette';

describe('KeyboardShortcutsPalette', () => {
  it('renders the palette heading and the global scope when open', () => {
    render(<KeyboardShortcutsPalette open onOpenChange={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /atajos de teclado/i })).toBeInTheDocument();
    expect(screen.getByText(/^global$/i)).toBeInTheDocument();
  });

  it('renders Spanish shortcut copy without encoding artifacts', () => {
    render(<KeyboardShortcutsPalette open onOpenChange={vi.fn()} />);

    expect(screen.getByText('Facturación y cobro.')).toBeInTheDocument();
    expect(screen.getByText(/búsqueda de servicios/i)).toBeInTheDocument();
    expect(screen.queryByText(/Ã|Â/)).not.toBeInTheDocument();
  });

  it('filters the visible shortcuts by the search input', async () => {
    render(<KeyboardShortcutsPalette open onOpenChange={vi.fn()} />);

    const search = screen.getByLabelText(/buscar atajo/i);
    fireEvent.change(search, { target: { value: 'facturar' } });

    await waitFor(() => {
      expect(screen.queryByText(/no se encontraron atajos/i)).toBeInTheDocument();
    });
  });

  it('opens with the question mark key when no input is focused', () => {
    const onOpenChange = vi.fn();
    render(<KeyboardShortcutsPalette open={false} onOpenChange={onOpenChange} />);

    fireEvent.keyDown(document.body, { key: '?' });

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('does not open with the question mark while an input is focused', () => {
    const onOpenChange = vi.fn();
    render(
      <>
        <input aria-label="dummy" defaultValue="" />
        <KeyboardShortcutsPalette open={false} onOpenChange={onOpenChange} />
      </>,
    );

    const input = screen.getByLabelText('dummy');
    input.focus();
    fireEvent.keyDown(input, { key: '?' });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('restores focus after a keyboard-opened palette closes', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Comandos</button>
        <KeyboardShortcutsPalette open={false} onOpenChange={onOpenChange} />
      </>,
    );
    const previousControl = screen.getByRole('button', { name: 'Comandos' });
    previousControl.focus();

    rerender(<><button type="button">Comandos</button><KeyboardShortcutsPalette open onOpenChange={onOpenChange} /></>);
    rerender(<><button type="button">Comandos</button><KeyboardShortcutsPalette open={false} onOpenChange={onOpenChange} /></>);

    await waitFor(() => expect(previousControl).toHaveFocus());
  });
});
