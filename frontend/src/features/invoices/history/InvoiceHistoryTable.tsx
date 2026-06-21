import { Receipt, Printer, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { StatusBadge } from '../../../components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import type { Invoice } from '../../../lib/api';

type InvoiceHistoryTableProps = {
  canReprint: boolean;
  canReprintAny: boolean;
  canReverse: boolean;
  canViewReceipt: boolean;
  canVoid: boolean;
  formatDate: (value: string) => string;
  invoices: Invoice[];
  isOwnInvoiceFromToday: (invoice: Invoice) => boolean;
  loadingActionInvoiceId: number | null;
  moneyLabel: (value: string | number | null | undefined) => string;
  onGenerateInstitutionalReceipt: (invoiceId: number) => void;
  onOpenReceipt: (invoiceId: number) => void;
  onPrepareInvoiceAction: (invoiceId: number, action: 'void' | 'reverse') => void;
  onReprint: (invoice: Invoice) => void;
};

export function InvoiceHistoryTable({
  canReprint,
  canReprintAny,
  canReverse,
  canViewReceipt,
  canVoid,
  formatDate,
  invoices,
  isOwnInvoiceFromToday,
  loadingActionInvoiceId,
  moneyLabel,
  onGenerateInstitutionalReceipt,
  onOpenReceipt,
  onPrepareInvoiceAction,
  onReprint,
}: InvoiceHistoryTableProps) {
  return (
    <Table containerLabel="Listado de facturas" className="min-w-[920px]">
      <TableCaption>
        Facturas filtradas con estado, montos y acciones autorizadas.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>No.</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Paciente</TableHead>
          <TableHead data-numeric="true">Total</TableHead>
          <TableHead data-numeric="true">Pagado</TableHead>
          <TableHead data-numeric="true">Saldo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell className="max-w-48 break-words text-sm font-medium tabular-nums">
              {invoice.invoice_number}
            </TableCell>
            <TableCell className="whitespace-nowrap">{formatDate(invoice.issued_at)}</TableCell>
            <TableCell className="max-w-56 break-words font-medium">{invoice.patient_name}</TableCell>
            <TableCell data-numeric="true">{moneyLabel(invoice.total)}</TableCell>
            <TableCell data-numeric="true">{moneyLabel(invoice.paid_amount)}</TableCell>
            <TableCell data-numeric="true">{moneyLabel(invoice.balance_due)}</TableCell>
            <TableCell>
              <InvoiceStatusBadge status={invoice.status} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-wrap justify-end gap-2">
                {canViewReceipt && (canReprintAny || canVoid || isOwnInvoiceFromToday(invoice)) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenReceipt(invoice.id)}
                  >
                    <Receipt data-icon aria-hidden="true" />
                    Ver recibo
                  </Button>
                )}
                {canViewReceipt && invoice.status === 'paid' && !issuedInstitutionalReceipt(invoice) && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loadingActionInvoiceId === invoice.id}
                    onClick={() => onGenerateInstitutionalReceipt(invoice.id)}
                  >
                    <Receipt data-icon aria-hidden="true" />
                    Generar PDF
                  </Button>
                )}

                {canReprint && (canReprintAny || isOwnInvoiceFromToday(invoice)) && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onReprint(invoice)}
                  >
                    <Printer data-icon aria-hidden="true" />
                    Reimprimir
                  </Button>
                )}

                {canReverse && (invoice.status === 'paid' || invoice.status === 'partial') && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={loadingActionInvoiceId === invoice.id}
                    onClick={() => onPrepareInvoiceAction(invoice.id, 'reverse')}
                  >
                    <XCircle data-icon aria-hidden="true" />
                    Reversar
                  </Button>
                )}

                {canVoid && invoice.status === 'issued' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={loadingActionInvoiceId === invoice.id}
                    onClick={() => onPrepareInvoiceAction(invoice.id, 'void')}
                  >
                    <XCircle data-icon aria-hidden="true" />
                    Anular
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function issuedInstitutionalReceipt(invoice: Invoice): NonNullable<Invoice['institutional_receipt']> | null {
  return invoice.institutional_receipt?.status === 'issued' ? invoice.institutional_receipt : null;
}

const statusConfig = {
  issued: { label: 'Emitida', status: 'info' },
  partial: { label: 'Parcial', status: 'partial' },
  paid: { label: 'Pagada', status: 'paid' },
  void: { label: 'Anulada', status: 'void' },
} as const;

function InvoiceStatusBadge({ status }: { status: Invoice['status'] }) {
  const config = statusConfig[status] ?? statusConfig.issued;

  return (
    <StatusBadge status={config.status}>
      {config.label}
    </StatusBadge>
  );
}
