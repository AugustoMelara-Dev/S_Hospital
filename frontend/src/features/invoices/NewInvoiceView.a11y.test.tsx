import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import type { ReactNode } from 'react';
import { NewInvoiceView } from './NewInvoiceView';
import { apiClient } from '../../lib/api';

function withQueryClient(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NewInvoiceView accessibility', () => {
  it('has no axe-core violations on the view', async () => {
    vi.spyOn(apiClient, 'getCurrentCashSession').mockResolvedValue(null);
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([
      {
        id: 1,
        name: 'Medicamentos',
        slug: 'medicamentos',
        active: true,
        sort_order: 1,
      },
    ]);
    vi.spyOn(apiClient, 'getServices').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(null);

    const { container } = withQueryClient(
      <NewInvoiceView
        cashSession={null}
        canCreatePayments
        canViewCatalog
        canViewReceipts
        onCashSessionChange={vi.fn()}
        onOpenCash={vi.fn()}
        onStatus={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('h1, [role="heading"]')).not.toBeNull();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});
