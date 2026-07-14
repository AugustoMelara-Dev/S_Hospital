export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function openBlobInNewTab(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');

  if (!opened) {
    downloadBlob(blob, filename);
    URL.revokeObjectURL(url);
    return;
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function institutionalReceiptPdfFilename(receiptNumber: string): string {
  return /^[A-Za-z0-9_-]+$/.test(receiptNumber)
    ? `recibo-institucional-${receiptNumber}.pdf`
    : 'recibo-institucional.pdf';
}
