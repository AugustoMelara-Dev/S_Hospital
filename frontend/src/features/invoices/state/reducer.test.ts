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

  it('resets the draft while preserving loaded POS settings and catalogs', () => {
    const categories = [{ id: 10, name: 'Laboratorio' }] as never;
    const serviceAreas = [{ id: 20, name: 'Farmacia' }] as never;
    const services = [{ id: 30, name: 'Eritropoyetina' }] as never;
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      patientName: 'Paciente demo',
      cartItems: [{ service: { id: 1, name: 'X' } as never, quantity: '1', dialysisPrescription: false }],
      search: 'demo',
      categories,
      serviceAreas,
      services,
      scannerEnabled: true,
      partialPaymentsEnabled: true,
      loadingServices: true,
    };

    const next = newInvoiceReducer(state, { type: 'RESET_FORM', payload: { loadedCashSession: cashSession } });

    expect(next).toMatchObject({
      patientName: '',
      cartItems: [],
      search: '',
      categories,
      serviceAreas,
      services,
      scannerEnabled: true,
      partialPaymentsEnabled: true,
      loadingServices: false,
      loadedCashSession: cashSession,
    });
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

  it('increments an existing prescribed erythropoietin line instead of creating a mixed duplicate', () => {
    const erythropoietinRule = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      cartItems: [{ service: { id: 3, name: 'Eritropoyetina', special_rule_code: erythropoietinRule } as never, quantity: '1.00', dialysisPrescription: true }],
    };

    const next = newInvoiceReducer(state, {
      type: 'ADD_TO_CART',
      payload: { id: 3, name: 'Eritropoyetina', special_rule_code: erythropoietinRule } as never,
    });

    expect(next.cartItems).toHaveLength(1);
    expect(next.cartItems[0]).toMatchObject({ quantity: '2.00', dialysisPrescription: true });
  });

  it('updates quantity and keeps the invoice-level dialysis decision consistent across EPO lines', () => {
    const erythropoietinRule = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      cartItems: [
        { service: { id: 1, special_rule_code: erythropoietinRule } as never, quantity: '1.00', dialysisPrescription: false },
        { service: { id: 2, special_rule_code: erythropoietinRule } as never, quantity: '1.00', dialysisPrescription: false },
      ],
    };

    const next = newInvoiceReducer(state, { type: 'UPDATE_QUANTITY', payload: { index: 0, quantity: '3.00' } });
    const withDialysis = newInvoiceReducer(next, { type: 'UPDATE_DIALYSIS', payload: { index: 1, checked: true } });

    expect(withDialysis.cartItems[0]?.quantity).toBe('3.00');
    expect(withDialysis.cartItems[0]?.dialysisPrescription).toBe(true);
    expect(withDialysis.cartItems[1]?.dialysisPrescription).toBe(true);
  });

  it('clears stale dialysis flags from non-EPO lines when normalizing the cart', () => {
    const next = newInvoiceReducer(getInitialNewInvoiceState(cashSession), {
      type: 'SET_CART_ITEMS',
      payload: [
        {
          service: { id: 1, special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' } as never,
          quantity: '1.00',
          dialysisPrescription: false,
        },
        {
          service: { id: 2, special_rule_code: null } as never,
          quantity: '1.00',
          dialysisPrescription: true,
        },
      ],
    });

    expect(next.cartItems.map((item) => item.dialysisPrescription)).toEqual([false, false]);
  });

  it('ignores dialysis updates targeted at non-EPO lines', () => {
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      cartItems: [{
        service: { id: 1, special_rule_code: null } as never,
        quantity: '1.00',
        dialysisPrescription: false,
      }],
    };

    const next = newInvoiceReducer(state, {
      type: 'UPDATE_DIALYSIS',
      payload: { index: 0, checked: true },
    });

    expect(next.cartItems[0]?.dialysisPrescription).toBe(false);
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
