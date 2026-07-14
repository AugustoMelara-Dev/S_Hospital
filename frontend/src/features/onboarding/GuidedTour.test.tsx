import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemProvider } from '../../design-system/providers/DesignSystemProvider';
import { GuidedTour, shouldAutoOpenGuidedTour } from './GuidedTour';

function CurrentPath() {
  const location = useLocation();
  return <output aria-label="Ruta actual">{location.pathname}</output>;
}

function renderTour(onOpenChange = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <DesignSystemProvider>
        <GuidedTour open onOpenChange={onOpenChange} />
        <CurrentPath />
      </DesignSystemProvider>
    </MemoryRouter>,
  );
  return onOpenChange;
}

describe('GuidedTour', () => {
  beforeEach(() => localStorage.clear());

  it('uses the real dialog contract and navigates through the operational steps', async () => {
    renderTour();

    const dialog = await screen.findByRole('dialog', { name: 'Guía rápida del sistema' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('1 de 6')).toBeInTheDocument();

    expect(screen.getByTestId('guided-tour-step')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Caja' }));
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/cashbox');
    expect(screen.getByText('2 de 6')).toBeInTheDocument();
  });

  it('records completion and closes through the public callback', async () => {
    const onOpenChange = renderTour();

    fireEvent.click(await screen.findByRole('button', { name: 'Respaldos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(localStorage.getItem('hospital-onboarding-completed')).toBe('true');
  });

  it('only auto-opens when explicitly enabled and incomplete', () => {
    expect(shouldAutoOpenGuidedTour()).toBe(false);
    localStorage.setItem('hospital-onboarding-auto', 'true');
    expect(shouldAutoOpenGuidedTour()).toBe(true);
    localStorage.setItem('hospital-onboarding-completed', 'true');
    expect(shouldAutoOpenGuidedTour()).toBe(false);
  });
});
