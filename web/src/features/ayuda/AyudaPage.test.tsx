import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AyudaPage from './AyudaPage';

describe('AyudaPage', () => {
  it('lists both groups, the shortcuts table and filters by search (accent-insensitive)', async () => {
    const user = userEvent.setup();
    render(<AyudaPage />);
    expect(screen.getByRole('heading', { name: 'Trabajo diario' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Administración autorizada' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Atajos de teclado' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar en la ayuda'), 'dialisis');
    expect(screen.getByRole('heading', { name: 'Eritropoyetina con receta de diálisis' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Respaldos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Administración autorizada' })).not.toBeInTheDocument();
  });
});
