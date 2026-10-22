import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  UnsavedChangesGuardProvider,
  useGuardedNavigation,
  useUnsavedChangesGuard,
} from './useUnsavedChangesGuard';

function LocationProbe() {
  return <output aria-label="Ruta actual">{useLocation().pathname}</output>;
}

function GuardedForm({ dirty }: { dirty: boolean }) {
  useUnsavedChangesGuard(dirty);
  return <p>Formulario sintético{dirty ? ' con cambios' : ' sin cambios'}</p>;
}

function ProgrammaticExit() {
  const requestNavigation = useGuardedNavigation();
  return (
    <button type="button" onClick={() => requestNavigation('/destino')}>
      Salir por comando
    </button>
  );
}

function dispatchBeforeUnload(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('useUnsavedChangesGuard', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('bloquea la recarga del navegador solo cuando hay cambios sin guardar', () => {
    const { rerender } = render(
      <MemoryRouter>
        <UnsavedChangesGuardProvider>
          <GuardedForm dirty />
        </UnsavedChangesGuardProvider>
      </MemoryRouter>,
    );

    expect(dispatchBeforeUnload()).toBe(true);

    rerender(
      <MemoryRouter>
        <UnsavedChangesGuardProvider>
          <GuardedForm dirty={false} />
        </UnsavedChangesGuardProvider>
      </MemoryRouter>,
    );

    expect(dispatchBeforeUnload()).toBe(false);
  });

  it('canaliza la navegación programática por la misma confirmación de descarte', async () => {
    render(
      <MemoryRouter initialEntries={['/formulario']}>
        <UnsavedChangesGuardProvider>
          <Routes>
            <Route path="/formulario" element={<GuardedForm dirty />} />
            <Route path="/destino" element={<h1>Destino</h1>} />
          </Routes>
          <ProgrammaticExit />
          <LocationProbe />
        </UnsavedChangesGuardProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /salir por comando/i }));

    const dialog = await screen.findByRole('alertdialog', { name: /descartar cambios sin guardar/i });
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/formulario');

    fireEvent.click(within(dialog).getByRole('button', { name: /descartar cambios/i }));

    expect(await screen.findByRole('heading', { name: 'Destino' })).toBeInTheDocument();
  });

  it('restaura la ruta y pide confirmación ante atrás del navegador', async () => {
    window.history.replaceState(null, '', '/origen');
    window.history.pushState(null, '', '/formulario');

    render(
      <BrowserRouter>
        <UnsavedChangesGuardProvider>
          <Routes>
            <Route path="/formulario" element={<GuardedForm dirty />} />
            <Route path="/origen" element={<h1>Origen</h1>} />
          </Routes>
          <LocationProbe />
        </UnsavedChangesGuardProvider>
      </BrowserRouter>,
    );

    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/formulario');

    window.history.back();

    const dialog = await screen.findByRole('alertdialog', { name: /descartar cambios sin guardar/i });
    await waitFor(() => expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/formulario'));

    fireEvent.click(within(dialog).getByRole('button', { name: /descartar cambios/i }));

    expect(await screen.findByRole('heading', { name: 'Origen' })).toBeInTheDocument();
  });

  function renderDirtyProgrammaticExit() {
    return render(
      <MemoryRouter initialEntries={['/formulario']}>
        <UnsavedChangesGuardProvider>
          <Routes>
            <Route path="/formulario" element={<GuardedForm dirty />} />
            <Route path="/destino" element={<h1>Destino</h1>} />
          </Routes>
          <ProgrammaticExit />
        </UnsavedChangesGuardProvider>
      </MemoryRouter>,
    );
  }

  it('devuelve el foco al control de origen al elegir "Seguir editando"', async () => {
    renderDirtyProgrammaticExit();

    const origin = screen.getByRole('button', { name: /salir por comando/i });
    origin.focus();
    expect(origin).toHaveFocus();

    fireEvent.click(origin);
    const dialog = await screen.findByRole('alertdialog', { name: /descartar cambios sin guardar/i });

    fireEvent.click(within(dialog).getByRole('button', { name: /seguir editando/i }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(origin).toHaveFocus());
  });

  it('devuelve el foco al control de origen al cerrar con Escape', async () => {
    renderDirtyProgrammaticExit();

    const origin = screen.getByRole('button', { name: /salir por comando/i });
    origin.focus();

    fireEvent.click(origin);
    await screen.findByRole('alertdialog', { name: /descartar cambios sin guardar/i });

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(origin).toHaveFocus());
  });
});
