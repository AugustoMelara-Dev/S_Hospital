import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NewInvoiceViewLayout } from './NewInvoiceViewLayout';
import { getInitialNewInvoiceState } from '../state/types';
import type { Service } from '../../../lib/api';

function renderLayout(overrides: Partial<React.ComponentProps<typeof NewInvoiceViewLayout>> = {}) {
  const noop = vi.fn();

  return render(
    <MemoryRouter>
      <NewInvoiceViewLayout
        state={{ ...getInitialNewInvoiceState(null), loadingServices: false }}
        preview={{ subtotal: '0.00', tax: '0.00', total: '0.00' }}
        emitBlockReasons={[]}
        canEmit={false}
        canCreatePayments
        canOpenCash
        canViewReceipts
        onOpenCash={noop}
        onPatientNameChange={noop}
        onPatientSubmit={noop}
        onAreaChange={noop}
        onCategoryChange={noop}
        onSearchChange={noop}
        onScanCodeChange={noop}
        onAddService={noop}
        onAddByScanCode={noop}
        onUpdateQuantity={noop}
        onUpdateDialysisPrescription={noop}
        onRemoveItem={noop}
        onConfirm={noop}
        onConfirmDialogChange={noop}
        onPaymentMethodChange={noop}
        onPaymentAmountChange={noop}
        onPaymentReferenceChange={noop}
        onSubmitInvoice={noop}
        onCobrar={noop}
        onRetryLoad={noop}
        onPaymentOpenChange={noop}
        onSubmitPayment={noop}
        onLoadReceipt={noop}
        onPrintIssuedReceipt={noop}
        onNuevaFactura={noop}
        onSuccessDialogChange={noop}
        onReceiptOpenChange={noop}
        onClearCart={noop}
        onClearConfirmChange={noop}
        onAutoPrintChange={noop}
        patientInputRef={createRef<HTMLInputElement>()}
        searchInputRef={createRef<HTMLInputElement>()}
        scannerInputRef={createRef<HTMLInputElement>()}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

describe('NewInvoiceViewLayout', () => {
  it('does not offer opening cash when the user lacks cash open permission', () => {
    renderLayout({ canOpenCash: false, onOpenCash: vi.fn() });

    expect(screen.queryByRole('button', { name: /abrir caja/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir a caja/i })).toHaveAttribute('href', '/cashbox');
    expect(screen.getByText(/solicite apertura a un usuario autorizado/i)).toBeInTheDocument();
  });

  it('shows a mobile total summary when the cart has services and reuses confirm action', () => {
    const onConfirm = vi.fn();
    renderLayout({
      state: {
        ...getInitialNewInvoiceState(null),
        loadingServices: false,
        patientName: 'Maria Lopez',
        cartItems: [{ service: serviceFixture(), quantity: '1.00', dialysisPrescription: false }],
      },
      preview: { subtotal: '120.00', tax: '18.00', total: '138.00' },
      canEmit: true,
      onConfirm,
    });

    expect(screen.getAllByText(/total estimado/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('L 138.00').length).toBeGreaterThan(0);

    const buttons = screen.getAllByRole('button', { name: /emitir y cobrar/i });
    expect(buttons.length).toBeGreaterThan(0);
    const mobileAction = buttons[0];
    expect(mobileAction).toBeEnabled();
    fireEvent.click(mobileAction);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keeps the mobile total summary hidden while the cart is empty', () => {
    renderLayout();

    expect(screen.queryByText(/^Total estimado$/i)).not.toBeInTheDocument();
  });
});

function serviceFixture(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    category_id: 1,
    area_id: 1,
    name: 'Hemograma',
    aliases: null,
    slug: 'hemograma',
    scan_code: null,
    barcode: null,
    qr_code: null,
    price: '120.00',
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
