import { describe, expect, it } from 'vitest';
import type { CashSession } from '../../../lib/api';
import { getInitialNewInvoiceState, type NewInvoiceState } from './types';
import { newInvoiceReducer } from './reducer';

const cashSession = { id: 7, status: 'open' as const, user_id: 1, opened_at: '2026-06-02T08:00:00Z' } as unknown as CashSession;

describe('newInvoiceReducer', () => {
  it('initializes with the provided cash session and default flags', () => {
    const state = getInitialNewInvoiceState(cashSession);

    expect(state).toMatchObject<Partial<NewInvoiceState>>({
      patientName: '',
      search: '',
      scanCode: '',
      cartItems: [],
      paymentMethod: 'cash',
      receiptWidth: 'half_letter',
      loadedCashSession: cashSession,
      loadingServices: true,
    });
  });

  it('returns a fresh state on RESET_FORM preserving the cash session', () => {
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      patientName: 'Paciente demo',
      cartItems: [{ service: { id: 1, name: 'X' } as never, quantity: '1', dialysisPrescription: false }],
      search: 'demo',
    };

    const next = newInvoiceReducer(state, { type: 'RESET_FORM', payload: { loadedCashSession: cashSession } });

    expect(next).toEqual(getInitialNewInvoiceState(cashSession));
  });

  it('keeps a success message untouched when it differs from the cleared id', () => {
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      successMessage: 'Otro mensaje',
    };

    const next = newInvoiceReducer(state, { type: 'CLEAR_SUCCESS_MESSAGE', payload: 'mensaje a borrar' });

    expect(next.successMessage).toBe('Otro mensaje');
  });

  it('increments the existing service quantity when ADD_TO_CART finds a match', () => {
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      cartItems: [{ service: { id: 1, name: 'Consulta' } as never, quantity: '1.00', dialysisPrescription: false }],
    };

    const next = newInvoiceReducer(state, { type: 'ADD_TO_CART', payload: { id: 1, name: 'Consulta' } as never });

    expect(next.cartItems).toHaveLength(1);
    expect(next.cartItems[0]?.quantity).toBe('2.00');
  });

  it('appends a new service when ADD_TO_CART does not find a match', () => {
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      cartItems: [],
    };

    const next = newInvoiceReducer(state, { type: 'ADD_TO_CART', payload: { id: 2, name: 'Otro' } as never });

    expect(next.cartItems).toHaveLength(1);
    expect(next.cartItems[0]?.quantity).toBe('1');
  });

  it('preserves the cart when adding a service that already has a dialysis prescription line', () => {
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      cartItems: [{ service: { id: 3, name: 'Eritropoyetina' } as never, quantity: '1.00', dialysisPrescription: true }],
    };

    const next = newInvoiceReducer(state, { type: 'ADD_TO_CART', payload: { id: 3, name: 'Eritropoyetina' } as never });

    expect(next.cartItems).toHaveLength(2);
    expect(next.cartItems[1]?.dialysisPrescription).toBe(false);
  });

  it('updates quantity and dialysis flag on the targeted cart item', () => {
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      cartItems: [
        { service: { id: 1 } as never, quantity: '1.00', dialysisPrescription: false },
        { service: { id: 2 } as never, quantity: '1.00', dialysisPrescription: false },
      ],
    };

    const next = newInvoiceReducer(state, { type: 'UPDATE_QUANTITY', payload: { index: 0, quantity: '3.00' } });
    const withDialysis = newInvoiceReducer(next, { type: 'UPDATE_DIALYSIS', payload: { index: 1, checked: true } });

    expect(withDialysis.cartItems[0]?.quantity).toBe('3.00');
    expect(withDialysis.cartItems[1]?.dialysisPrescription).toBe(true);
  });

  it('removes the cart item at the given index', () => {
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      cartItems: [
        { service: { id: 1 } as never, quantity: '1.00', dialysisPrescription: false },
        { service: { id: 2 } as never, quantity: '1.00', dialysisPrescription: false },
      ],
    };

    const next = newInvoiceReducer(state, { type: 'REMOVE_ITEM', payload: 0 });

    expect(next.cartItems).toHaveLength(1);
    expect(next.cartItems[0]?.service.id).toBe(2);
  });

  it('appends a service result page and tracks whether another page is available', () => {
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      services: [{ id: 1, name: 'Primero' } as never],
    };

    const next = newInvoiceReducer(state, {
      type: 'APPEND_SERVICES_PAGE',
      payload: { services: [{ id: 2, name: 'Segundo' } as never], page: 2, hasMore: true },
    });

    expect(next.services.map((service) => service.id)).toEqual([1, 2]);
    expect(next.servicePage).toBe(2);
    expect(next.hasMoreServices).toBe(true);
  });

  it('stores the cash received and change as the completed payment snapshot', () => {
    const state = getInitialNewInvoiceState(cashSession);
    const next = newInvoiceReducer(state, {
      type: 'SET_COMPLETED_PAYMENT_CASH',
      payload: { receivedAmount: '50.00', changeAmount: '32.75' },
    });

    expect(next.completedPaymentReceivedAmount).toBe('50.00');
    expect(next.completedPaymentChangeAmount).toBe('32.75');
  });

  it('resets the cart completely without touching the cash session', () => {
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      patientName: 'Juan',
      search: 'demo',
      scanCode: 'X-1',
      selectedCategoryId: 1,
    };

    const next = newInvoiceReducer(state, { type: 'CLEAR_CART_COMPLETELY' });

    expect(next).toMatchObject({
      cartItems: [],
      patientName: '',
      search: '',
      scanCode: '',
      selectedCategoryId: undefined,
      loadedCashSession: cashSession,
    });
  });
});
