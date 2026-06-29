import { Printer, Receipt, ReceiptText, User, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { StatusBadge } from '../../../components/ui/status-badge';
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
  const columns: Array<DataTableColumn<Invoice>> = [
    {
      key: 'invoice_number',
      header: 'No.',
      cellClassName: 'max-w-56 break-words text-sm font-semibold tabular-nums',
      render: (invoice) => (
        <div className="flex items-start gap-2">
          <ReceiptText data-icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-secondary" />
          <span>{invoice.invoice_number}</span>
        </div>
      ),
    },
    {
      key: 'issued_at',
      header: 'Fecha',
      cellClassName: 'whitespace-nowrap',
      render: (invoice) => formatDate(invoice.issued_at),
    },
    {
      key: 'patient_name',
      header: 'Paciente',
      cellClassName: 'max-w-60 break-words font-medium',
      render: (invoice) => (
        <div className="flex items-start gap-2">
          <User data-icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{invoice.patient_name}</span>
        </div>
      ),
    },
    { key: 'total', header: 'Total', numeric: true, render: (invoice) => moneyLabel(invoice.total) },
    { key: 'paid_amount', header: 'Pagado', numeric: true, render: (invoice) => moneyLabel(invoice.paid_amount) },
    {
      key: 'balance_due',
      header: 'Saldo',
      numeric: true,
      render: (invoice) => (
        <span className={invoice.status === 'partial' || invoice.status === 'issued' ? 'font-semibold text-warning-foreground' : undefined}>
          {moneyLabel(invoice.balance_due)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (invoice) => <InvoiceStatusBadge status={invoice.status} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'min-w-72 text-right',
      hideable: false,
      render: (invoice) => (
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
              onClick={() => onPrepareInvoiceAction(invoice.id, 'void')}
            >
              <XCircle data-icon aria-hidden="true" />
              Anular
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      caption="Facturas filtradas con estado, montos y acciones autorizadas."
      containerLabel="Listado de facturas"
      tableClassName="min-w-[980px]"
      rows={invoices}
      columns={columns}
      getRowKey={(invoice) => invoice.id}
      showColumnVisibility
    />
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
