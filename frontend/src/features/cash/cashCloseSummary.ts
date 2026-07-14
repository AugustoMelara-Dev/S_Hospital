import { formatDateTimeEs } from '@/lib/format/formatDate';
import { formatLempirasUI } from '@/lib/money';

export type CashCloseSummaryPayload = {
  cashSessionId?: number;
  closedAt?: string | null;
  openingAmount: number;
  expectedAmount: number;
  methods: { cash: string; transfer: string; card: string; other: string };
  pendingAmount: number;
  pendingInvoiceCount: number;
  closingAmount: string;
  difference: number;
  closingNotes: string;
};

export function buildCloseSummaryCsv({
  cashSessionId,
  closedAt,
  openingAmount,
  expectedAmount,
  methods,
  pendingAmount,
  pendingInvoiceCount,
  closingAmount,
  difference,
  closingNotes,
}: CashCloseSummaryPayload): string {
  const rows = [
    ['Campo', 'Valor'],
    ...(cashSessionId ? [['Caja', `Caja #${cashSessionId}`]] : []),
    ...(closedAt ? [['Cerrada', formatDateTimeEs(closedAt)]] : []),
    ['Monto apertura', formatLempirasUI(openingAmount)],
    ['Efectivo esperado', formatLempirasUI(expectedAmount)],
    ['Efectivo', formatLempirasUI(methods.cash)],
    ['Transferencia', formatLempirasUI(methods.transfer)],
    ['Tarjeta', formatLempirasUI(methods.card)],
    ['Otros', formatLempirasUI(methods.other)],
    ['Facturas pendientes', String(pendingInvoiceCount)],
    ['Saldo pendiente', formatLempirasUI(pendingAmount)],
    ['Monto contado', formatLempirasUI(closingAmount || '0.00')],
    ['Diferencia', formatLempirasUI(difference)],
    ['Nota', closingNotes.trim() || 'Sin nota'],
  ];

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

export function downloadCloseSummaryCsv(
  payload: CashCloseSummaryPayload,
  now = new Date(),
): Blob {
  const csv = buildCloseSummaryCsv(payload);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `resumen-cierre-caja-${now.toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);

  return blob;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
