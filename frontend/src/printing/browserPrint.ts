import type { ReceiptData } from '../lib/api';

export function printReceiptDocument(
  width: ReceiptData['width'],
  print: () => void = () => window.print(),
) {
  const previousWidth = document.body.dataset.receiptWidth;
  const previousPrinting = document.body.dataset.printingReceipt;

  document.body.dataset.receiptWidth = width;
  document.body.dataset.printingReceipt = 'true';

  try {
    print();
  } finally {
    restoreDataset('receiptWidth', previousWidth);
    restoreDataset('printingReceipt', previousPrinting);
  }
}

function restoreDataset(key: 'receiptWidth' | 'printingReceipt', value: string | undefined) {
  if (value === undefined) {
    delete document.body.dataset[key];
    return;
  }

  document.body.dataset[key] = value;
}
