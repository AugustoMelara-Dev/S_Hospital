import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { FeedbackProvider, useFeedback } from './FeedbackProvider';
import { ThemeProvider } from './ThemeProvider';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

function FeedbackHarness() {
  const feedback = useFeedback();
  return (
    <>
      <button onClick={() => feedback.success('Guardado')}>success</button>
      <button onClick={() => feedback.info('Informacion')}>info</button>
      <button onClick={() => feedback.warning('Advertencia')}>warning</button>
      <button onClick={() => feedback.error('Error')}>error</button>
      <button onClick={() => feedback.notify({ key: 'cash:open', level: 'success', message: 'Caja abierta' })}>notify</button>
    </>
  );
}

describe('FeedbackProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps the stable feedback API to Sonner and renders one toaster', () => {
    render(<ThemeProvider><FeedbackProvider><FeedbackHarness /></FeedbackProvider></ThemeProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'success' }));
    fireEvent.click(screen.getByRole('button', { name: 'info' }));
    fireEvent.click(screen.getByRole('button', { name: 'warning' }));
    fireEvent.click(screen.getByRole('button', { name: 'error' }));
    fireEvent.click(screen.getByRole('button', { name: 'notify' }));

    expect(toast.success).toHaveBeenCalledWith('Guardado', { duration: 6_000 });
    expect(toast.info).toHaveBeenCalledWith('Informacion', { duration: 8_000 });
    expect(toast.warning).toHaveBeenCalledWith('Advertencia', { duration: 12_000 });
    expect(toast.error).toHaveBeenCalledWith('Error', { duration: Number.POSITIVE_INFINITY });
    expect(toast.success).toHaveBeenCalledWith('Caja abierta', { duration: 6_000, id: 'cash:open' });
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
  });
});
