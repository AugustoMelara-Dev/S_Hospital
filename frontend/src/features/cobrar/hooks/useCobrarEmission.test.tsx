import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ApiError, apiClient, type Invoice } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useCobrarEmission } from './useCobrarEmission';

afterEach(() => vi.restoreAllMocks());

describe('billing report cache after issuing', () => {
  it.each([
    { code: 'RESTORE_RECONCILIATION_PENDING', pending: false },
    { code: undefined, pending: true },
  ])('distinguishes a definitive restore block from an uncertain 409 ($code)', async ({ code, pending }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const createInvoice = vi.spyOn(apiClient, 'createInvoice').mockRejectedValue(new ApiError(
      'Conflicto', 409, undefined, undefined, 'POST', undefined, code,
    ));
    const registerPayment = vi.spyOn(apiClient, 'registerPayment');
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useCobrarEmission({ cashSessionId: 42, canCreatePayments: true, canViewReceipts: false, onStatus: vi.fn() }), { wrapper });
    const payload = { patient_name: 'Paciente conservado', items: [{ service_id: 1, quantity: '1' }] };
    let outcome;
    await act(async () => {
      outcome = await result.current.submit({ payload, method: 'cash', reference: '' });
    });
    expect(outcome).toEqual({ ok: false, message: pending ? expect.stringMatching(/Reintente esta misma operación/) : expect.stringMatching(/Un administrador debe confirmar los correlativos/) });
    expect(result.current.invoiceResolutionPending).toBe(pending);
    expect(result.current.result).toBeNull();
    expect(result.current.submitting).toBe(false);
    expect(createInvoice).toHaveBeenCalledTimes(1);
    expect(registerPayment).not.toHaveBeenCalled();
    expect(payload).toEqual({ patient_name: 'Paciente conservado', items: [{ service_id: 1, quantity: '1' }] });
    client.clear();
  });

  it('invalidates executive reports after the real zero-total emission flow', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = queryKeys.reports.executive({ date_from: '2026-06-01', date_to: '2026-06-02' });
    client.setQueryData(key, { summary: { invoice_count: 1 } });
    vi.spyOn(apiClient, 'createInvoice').mockResolvedValue({
      id: 55, invoice_number: 'QA-55', patient_name: 'Paciente QA', subtotal: '0.00', tax_amount: '0.00', discount_amount: '0.00', total: '0.00', paid_amount: '0.00', balance_due: '0.00', status: 'paid', issued_at: '2026-06-02T08:00:00-06:00', items: [],
    } satisfies Invoice);
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useCobrarEmission({ cashSessionId: 42, canCreatePayments: true, canViewReceipts: false, onStatus: vi.fn() }), { wrapper });
    await act(async () => {
      await result.current.submit({ payload: { patient_name: 'Paciente QA', items: [{ service_id: 1, quantity: '1' }] }, method: 'cash', reference: '' });
    });
    expect(result.current.result?.outcome).toBe('sin_cobro');
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    client.clear();
  });
});
