import type { Invoice } from '../../../lib/api/types';

export type InvoiceActionPermissions = {
  canIssueInstitutionalReceipt: boolean;
  canCollectPayment: boolean;
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
  collectPayment: boolean;
  downloadInstitutionalReceipt: boolean;
  generateInstitutionalReceipt: boolean;
  reprint: boolean;
  reverse: boolean;
  void: boolean;
};

const NO_ACTIONS: InvoiceActionPolicy = {
  openReceipt: false,
  auditedOpen: false,
  collectPayment: false,
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
    && canOperateReceipt;
  const canUseInvoiceReceiptFallback = invoice.status === 'paid' || invoice.status === 'partial';
  const openReceiptFallback = permissions.canViewReceipt
    && canOperateReceipt
    && canUseInvoiceReceiptFallback
    && !receipt
    && !generateInstitutionalReceipt;
  const reprintReceiptFallback = canUseInvoiceReceiptFallback && !receipt && !generateInstitutionalReceipt;
  const hasReprintableReceipt = Boolean(receipt) || reprintReceiptFallback;

  return {
    collectPayment: permissions.canCollectPayment
      && canOperateInvoice
      && (invoice.status === 'issued' || invoice.status === 'partial'),
    openReceipt: openInstitutionalReceipt || openReceiptFallback,
    auditedOpen: false,
    downloadInstitutionalReceipt: openInstitutionalReceipt,
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
