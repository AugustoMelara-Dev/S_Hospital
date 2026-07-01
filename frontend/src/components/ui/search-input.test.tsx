import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchInput } from './search-input';

describe('SearchInput', () => {
  it('labels the search field and emits value changes', () => {
    const onValueChange = vi.fn();

    render(
      <SearchInput
        id="service-search"
        label="Buscar servicio"
        value=""
        onValueChange={onValueChange}
        placeholder="Buscar por nombre o codigo..."
      />,
    );

    const input = screen.getByRole('searchbox', { name: 'Buscar servicio' });
    expect(input).toHaveAttribute('id', 'service-search');
    expect(input).toHaveAttribute('autocomplete', 'off');

    fireEvent.change(input, { target: { value: 'glucosa' } });

    expect(onValueChange).toHaveBeenCalledWith('glucosa');
  });

  it('offers an accessible clear action only when it has a value', () => {
    const onValueChange = vi.fn();

    const { rerender } = render(
      <SearchInput
        label="Buscar factura"
        value=""
        onValueChange={onValueChange}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Limpiar busqueda' })).not.toBeInTheDocument();

    rerender(
      <SearchInput
        label="Buscar factura"
        value="FAC-001"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar busqueda' }));

    expect(onValueChange).toHaveBeenCalledWith('');
  });
});
