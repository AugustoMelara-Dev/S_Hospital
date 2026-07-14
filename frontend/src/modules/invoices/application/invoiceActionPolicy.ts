import type { Invoice } from '../../../lib/api/types';

export type InvoiceActionPermissions = {
  canIssueInstitutionalReceipt: boolean;
  canOperateAnyInvoice: boolean;
  canReprint: boolean;
  canReprintAny: boolean;
  canReverse: boolean;
  canViewReceipt: boolean;
  canVoid: boolean;
  isOwnInvoiceFromToday: boolean;
};

export type InvoiceActionPolicy = {
  openReceipt: boolean;
  auditedOpen: boolean;
  downloadInstitutionalReceipt: boolean;
  generateInstitutionalReceipt: boolean;
  reprint: boolean;
  reverse: boolean;
  void: boolean;
};

const NO_ACTIONS: InvoiceActionPolicy = {
  openReceipt: false,
  auditedOpen: false,
  downloadInstitutionalReceipt: false,
  generateInstitutionalReceipt: false,
  reprint: false,
  reverse: false,
  void: false,
};

export function invoiceActionPolicy(
  invoice: Invoice,
  permissions: InvoiceActionPermissions,
): InvoiceActionPolicy {
  if (invoice.status === 'void') {
    return { ...NO_ACTIONS };
  }

  const receipt = getIssuedInstitutionalReceipt(invoice);
  const printed = receipt ? hasInstitutionalPrintEvents(receipt) : false;
  const canOperateInvoice = permissions.canOperateAnyInvoice || permissions.isOwnInvoiceFromToday;
  const canOperateReceipt = permissions.canReprintAny
    || permissions.canOperateAnyInvoice
    || permissions.isOwnInvoiceFromToday;
  const generateInstitutionalReceipt = permissions.canIssueInstitutionalReceipt
    && canOperateInvoice
    && invoice.status === 'paid'
    && !receipt;
  const openInstitutionalReceipt = Boolean(receipt)
    && permissions.canViewReceipt
    && canOperateReceipt
    && (!printed || permissions.canReprint);
  const canUseInvoiceReceiptFallback = invoice.status === 'paid' || invoice.status === 'partial';
  const openReceiptFallback = permissions.canViewReceipt
    && canOperateReceipt
    && canUseInvoiceReceiptFallback
    && !receipt
    && !generateInstitutionalReceipt;
  const reprintReceiptFallback = canUseInvoiceReceiptFallback && !receipt && !generateInstitutionalReceipt;
  const hasReprintableReceipt = Boolean(receipt) || reprintReceiptFallback;

  return {
    openReceipt: openInstitutionalReceipt || openReceiptFallback,
    auditedOpen: openInstitutionalReceipt && printed,
    downloadInstitutionalReceipt: openInstitutionalReceipt && !printed,
    generateInstitutionalReceipt,
    reprint: permissions.canReprint
      && (permissions.canReprintAny || permissions.isOwnInvoiceFromToday)
      && hasReprintableReceipt,
    reverse: permissions.canReverse
      && canOperateInvoice
      && (invoice.status === 'paid' || invoice.status === 'partial'),
    void: permissions.canVoid && canOperateInvoice && invoice.status === 'issued',
  };
}

export function getIssuedInstitutionalReceipt(
  invoice: Invoice,
): NonNullable<Invoice['institutional_receipt']> | null {
  return invoice.institutional_receipt?.status === 'issued' ? invoice.institutional_receipt : null;
}

function hasInstitutionalPrintEvents(receipt: NonNullable<Invoice['institutional_receipt']>): boolean {
  return receipt.has_print_events === true || (receipt.print_events_count ?? 0) > 0;
}
