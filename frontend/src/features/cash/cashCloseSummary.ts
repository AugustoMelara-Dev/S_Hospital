import { formatDateTimeEs } from '@/lib/format/formatDate';
import { parseCents } from '@/lib/moneyCents';
import { formatCashCents } from './cashMoney';
import type { CashClosingBreakdown } from '@/lib/api/types';

export type CashCloseSummaryPayload = {
  openedAt?: string | null;
  closedAt?: string | null;
  openingAmountCents: number | null;
  expectedAmountCents: number | null;
  methodsCents: { cash: number | null; transfer: number | null; card: number | null; other: number | null };
  pendingAmountCents: number | null;
  pendingInvoiceCount: number;
  closingAmountCents: number | null;
  differenceCents: number | null;
  closingNotes: string;
  closingBreakdown?: CashClosingBreakdown | null;
};

export function buildCloseSummaryCsv({
  openedAt,
  closedAt,
  openingAmountCents,
  expectedAmountCents,
  methodsCents,
  pendingAmountCents,
  pendingInvoiceCount,
  closingAmountCents,
  differenceCents,
  closingNotes,
  closingBreakdown,
}: CashCloseSummaryPayload): string {
  const rows = [
    ['Campo', 'Valor'],
    ...(openedAt ? [['Turno abierto', formatDateTimeEs(openedAt)]] : []),
    ...(closedAt ? [['Cerrada', formatDateTimeEs(closedAt)]] : []),
    ['Monto apertura', formatCashCents(openingAmountCents)],
    ['Efectivo esperado', formatCashCents(expectedAmountCents)],
    ['Efectivo', formatCashCents(methodsCents.cash)],
    ['Transferencia', formatCashCents(methodsCents.transfer)],
    ['Tarjeta', formatCashCents(methodsCents.card)],
    ['Otros', formatCashCents(methodsCents.other)],
    ['Facturas pendientes', String(pendingInvoiceCount)],
    ['Saldo pendiente', formatCashCents(pendingAmountCents)],
    ['Monto contado', formatCashCents(closingAmountCents)],
    ...(closingBreakdown
      ? Object.entries(closingBreakdown.bills)
        .filter(([, count]) => count > 0)
        .map(([denomination, count]) => [`Billetes L ${denomination}`, String(count)])
      : []),
    ...(closingBreakdown ? [['Monedas y otros', formatCashCents(parseCents(closingBreakdown.other_amount))]] : []),
    ['Diferencia', formatCashCents(differenceCents)],
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
