import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReportsCash } from './ReportsCash';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getCashSessionReport: vi.fn(),
    },
  };
});

const { apiClient } = await import('@/lib/api');

describe('ReportsCash', () => {
  it('shows a loading state while cash session report is loading', () => {
    vi.mocked(apiClient.getCashSessionReport).mockReturnValue(new Promise(() => undefined));

    render(<ReportsCash canViewCash canViewManagerial={false} />);

    fireEvent.change(screen.getByLabelText(/numero de caja/i), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /ver caja/i }));

    expect(apiClient.getCashSessionReport).toHaveBeenCalledWith('12');
    expect(screen.getByRole('button', { name: /consultando/i })).toBeDisabled();
  });
});
