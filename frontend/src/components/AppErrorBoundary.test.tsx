import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function BrokenView() {
  throw new Error('render exploded');

  return null;
}

describe('AppErrorBoundary', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 201 }))) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('shows human recovery instructions and logs support evidence', async () => {
    render(
      <AppErrorBoundary>
        <BrokenView />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: /la pantalla no pudo cargarse/i })).toBeInTheDocument();
    expect(screen.getByText(/avise a supervisor o soporte/i)).toBeInTheDocument();
    expect(screen.queryByText(/consola del navegador/i)).not.toBeInTheDocument();

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/system/client-errors',
      expect.objectContaining({
        method: 'POST',
      }),
    ));
  });
});
