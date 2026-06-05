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
      selectedAreaId: 'all',
      selectedCategoryId: 'all',
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

  it('loads cash session, areas, categories and services together', () => {
    const area = { id: 2, name: 'Rayos X', slug: 'rayos-x', active: true };
    const category = { id: 3, name: 'Imagenes', slug: 'imagenes', active: true, sort_order: 2 };
    const service = { id: 4, name: 'Rayos X torax', category_id: 3, area_id: 2 } as never;
    const state = getInitialNewInvoiceState(null);

    const next = newInvoiceReducer(state, {
      type: 'LOAD_DATA_SUCCESS',
      payload: {
        loadedCashSession: cashSession,
        areas: [area],
        categories: [category],
        services: [service],
      },
    });

    expect(next.loadedCashSession).toBe(cashSession);
    expect(next.areas).toEqual([area]);
    expect(next.categories).toEqual([category]);
    expect(next.services).toEqual([service]);
  });

  it('updates the selected area filter', () => {
    const state = getInitialNewInvoiceState(cashSession);

    const next = newInvoiceReducer(state, { type: 'SET_SELECTED_AREA_ID', payload: 2 });

    expect(next.selectedAreaId).toBe(2);
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

  it('resets the cart completely without touching the cash session', () => {
    const state: NewInvoiceState = {
      ...getInitialNewInvoiceState(cashSession),
      patientName: 'Juan',
      search: 'demo',
      scanCode: 'X-1',
      selectedAreaId: 2,
      selectedCategoryId: 1,
    };

    const next = newInvoiceReducer(state, { type: 'CLEAR_CART_COMPLETELY' });

    expect(next).toMatchObject({
      cartItems: [],
      patientName: '',
      search: '',
      scanCode: '',
      selectedAreaId: 'all',
      selectedCategoryId: 'all',
      loadedCashSession: cashSession,
    });
  });
});
