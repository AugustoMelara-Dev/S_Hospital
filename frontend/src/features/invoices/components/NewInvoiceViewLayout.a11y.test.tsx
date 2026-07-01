import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { configureAxe } from 'vitest-axe';
import { NewInvoiceViewLayout } from './NewInvoiceViewLayout';
import { getInitialNewInvoiceState } from '../state/types';

const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

describe('NewInvoiceViewLayout accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has no axe-core violations on the empty POS', async () => {
    const { container } = render(
      <MemoryRouter>
        <NewInvoiceViewLayout
          state={getInitialNewInvoiceState(null)}
          preview={{ subtotal: '0.00', tax: '0.00', total: '0.00' }}
          emitBlockReasons={[]}
          canEmit={false}
          canCreatePayments
          canOpenCash
          canViewReceipts
          onOpenCash={() => {}}
          onPatientNameChange={() => {}}
          onPatientSubmit={() => {}}
          onAreaChange={() => {}}
          onCategoryChange={() => {}}
          onSearchChange={() => {}}
          onScanCodeChange={() => {}}
          onAddService={() => {}}
          onAddByScanCode={() => {}}
          onUpdateQuantity={() => {}}
          onUpdateDialysisPrescription={() => {}}
          onRemoveItem={() => {}}
          onConfirm={() => {}}
          onConfirmDialogChange={() => {}}
          onPaymentMethodChange={() => {}}
          onPaymentAmountChange={() => {}}
          onPaymentReferenceChange={() => {}}
          onSubmitInvoice={() => {}}
          onCobrar={() => {}}
          onRetryLoad={() => {}}
          onPaymentOpenChange={() => {}}
          onSubmitPayment={() => {}}
          onLoadReceipt={() => {}}
          onPrintIssuedReceipt={() => {}}
          onNuevaFactura={() => {}}
          onSuccessDialogChange={() => {}}
          onReceiptOpenChange={() => {}}
          onClearCart={() => {}}
          onClearConfirmChange={() => {}}
          onAutoPrintChange={() => {}}
          patientInputRef={{ current: null }}
          searchInputRef={{ current: null }}
          scannerInputRef={{ current: null }}
        />
      </MemoryRouter>,
    );

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
