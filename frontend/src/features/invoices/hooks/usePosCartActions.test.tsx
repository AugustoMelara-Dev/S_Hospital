import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiClient, type Service } from '../../../lib/api';
import { getInitialNewInvoiceState, type NewInvoiceAction, type NewInvoiceState } from '../state/types';
import { usePosCartActions } from './usePosCartActions';

describe('usePosCartActions', () => {
  it('uses institutional service identifier wording for empty scan input', async () => {
    const dispatch = vi.fn();
    const onStatus = vi.fn();
    const { result } = renderCartHook({
      state: { ...getInitialNewInvoiceState(null), scanCode: '' },
      dispatch,
      onStatus,
    });

    await act(async () => {
      await result.current.addByScanCode();
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_ALERT_MESSAGE',
      payload: 'Ingrese o escanee un identificador de servicio.',
    });
    expect(onStatus).toHaveBeenCalledWith('Ingrese o escanee un identificador de servicio.');
    expect(allOperatorMessages(dispatch, onStatus)).not.toMatch(/codigo|c\u00f3digo/i);
  });

  it('announces service lookup success as an identifier flow', async () => {
    vi.spyOn(apiClient, 'getServices').mockResolvedValue([serviceFixture()]);
    const dispatch = vi.fn();
    const onStatus = vi.fn();
    const { result } = renderCartHook({
      state: { ...getInitialNewInvoiceState(null), scanCode: 'LAB-GLU-001' },
      dispatch,
      onStatus,
    });

    await act(async () => {
      await result.current.addByScanCode();
    });

    expect(onStatus).toHaveBeenCalledWith('Servicio agregado por identificador: Glucosa.');
    expect(allOperatorMessages(dispatch, onStatus)).not.toMatch(/codigo|c\u00f3digo/i);
  });

  it('uses service identifier wording when lookup fails before a backend message is safe', async () => {
    vi.spyOn(apiClient, 'getServices').mockRejectedValue(new Error('SQLSTATE[HY000]: trace'));
    const dispatch = vi.fn();
    const onStatus = vi.fn();
    const { result } = renderCartHook({
      state: { ...getInitialNewInvoiceState(null), scanCode: 'LAB-GLU-001' },
      dispatch,
      onStatus,
    });

    await act(async () => {
      await result.current.addByScanCode();
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_ALERT_MESSAGE',
      payload: 'No se pudo buscar el identificador de servicio.',
    });
    expect(onStatus).toHaveBeenCalledWith('No se pudo buscar el identificador de servicio.');
    expect(allOperatorMessages(dispatch, onStatus)).not.toMatch(/codigo|c\u00f3digo|SQLSTATE|trace/i);
  });
});

function renderCartHook({
  state,
  dispatch,
  onStatus,
}: {
  state: NewInvoiceState;
  dispatch: (action: NewInvoiceAction) => void;
  onStatus: (message: string) => void;
}) {
  return renderHook(() =>
    usePosCartActions({
      state,
      dispatch,
      onStatus,
      fiscalTaxRate: '15.00',
      patientInputRef: inputRef(),
      searchInputRef: inputRef(),
      scannerInputRef: inputRef(),
    }),
  );
}

function inputRef() {
  return { current: document.createElement('input') };
}

function allOperatorMessages(
  dispatch: ReturnType<typeof vi.fn>,
  onStatus: ReturnType<typeof vi.fn>,
): string {
  const dispatchMessages = dispatch.mock.calls
    .map(([action]) => action)
    .filter((action): action is Extract<NewInvoiceAction, { payload: string | null | undefined }> =>
      action && typeof action === 'object' && 'payload' in action,
    )
    .map((action) => action.payload)
    .filter((payload): payload is string => typeof payload === 'string');
  const statusMessages = onStatus.mock.calls
    .map(([message]) => message)
    .filter((message): message is string => typeof message === 'string');

  return [...dispatchMessages, ...statusMessages].join('\n');
}

function serviceFixture(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    category_id: 1,
    area_id: 1,
    name: 'Glucosa',
    aliases: null,
    slug: 'glucosa',
    scan_code: 'LAB-GLU-001',
    barcode: null,
    qr_code: null,
    price: '15.00',
    taxable: true,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: null,
    category: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    area: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true },
    ...overrides,
  };
}
