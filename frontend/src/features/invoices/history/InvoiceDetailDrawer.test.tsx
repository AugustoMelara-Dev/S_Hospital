import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Invoice } from '../../../lib/api';
import { InvoiceDetailDrawer } from './InvoiceDetailDrawer';

describe('InvoiceDetailDrawer', () => {
  it('keeps authorized actions in the visible Drawer footer', () => {
    const invoice = {
      id: 41,
      invoice_number: '000-001-01-00000041',
      patient_name: 'Paciente Prueba',
      issued_at: '2026-07-14T10:00:00-06:00',
      status: 'issued',
      subtotal: '100.00',
      tax_amount: '15.00',
      discount_amount: '0.00',
      total: '115.00',
      paid_amount: '0.00',
      balance_due: '115.00',
      items: [],
      payments: [],
      institutional_receipt: null,
    } as unknown as Invoice;

    render(
      <InvoiceDetailDrawer
        error=""
        invoice={invoice}
        loading={false}
        loadingActionInvoiceId={null}
        moneyLabel={(value) => `L ${value}`}
        onAfterClose={vi.fn()}
        onDownloadInstitutionalReceipt={vi.fn()}
        onGenerateInstitutionalReceipt={vi.fn()}
        onOpenChange={vi.fn()}
        onOpenReceipt={vi.fn()}
        onPrepareInvoiceAction={vi.fn()}
        onReprint={vi.fn()}
        open
        permissions={{
          canCollectPayment: false,
          canIssueInstitutionalReceipt: false,
          canOperateAnyInvoice: true,
          canReprint: false,
          canReprintAny: false,
          canReverse: false,
          canViewReceipt: false,
          canVoid: true,
          isOwnInvoiceFromToday: false,
        }}
      />,
    );

    const footer = document.querySelector('.ant-drawer-footer');
    expect(footer).not.toBeNull();
    expect(footer).toContainElement(screen.getByRole('button', { name: /anular factura/i }));
    expect(document.querySelector('.ant-drawer-body')).not.toContainElement(
      screen.getByRole('button', { name: /anular factura/i }),
    );
  });
});
