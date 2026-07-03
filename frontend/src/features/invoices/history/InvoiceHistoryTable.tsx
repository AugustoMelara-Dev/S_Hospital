import { Download, Printer, Receipt, ReceiptText, User, XCircle } from 'lucide-react';
import { ActionMenu, type ActionMenuGroup } from '../../../components/ui/action-menu';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import type { Invoice } from '../../../lib/api';

type InvoiceHistoryTableProps = {
  canIssueInstitutionalReceipt: boolean;
  canOperateAnyInvoice: boolean;
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
  onDownloadInstitutionalReceipt: (invoice: Invoice) => void;
  onGenerateInstitutionalReceipt: (invoiceId: number) => void;
  onOpenReceipt: (invoiceId: number) => void;
  onPrepareInvoiceAction: (invoiceId: number, action: 'void' | 'reverse') => void;
  onReprint: (invoice: Invoice) => void;
};

export function InvoiceHistoryTable({
  canIssueInstitutionalReceipt,
  canOperateAnyInvoice,
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
  onDownloadInstitutionalReceipt,
  onGenerateInstitutionalReceipt,
  onOpenReceipt,
  onPrepareInvoiceAction,
  onReprint,
}: InvoiceHistoryTableProps) {
  const columns: Array<DataTableColumn<Invoice>> = [
    {
      key: 'invoice_number',
      header: 'Factura',
      cellClassName: 'max-w-56 break-words text-sm font-semibold tabular-nums',
      hideable: false,
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
      hideable: false,
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
      key: 'receipt',
      header: 'Recibo',
      cellClassName: 'max-w-48 break-words text-xs',
      render: (invoice) => <ReceiptTrace invoice={invoice} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      hideable: false,
      render: (invoice) => {
        const isOwn = isOwnInvoiceFromToday(invoice);
        const institutionalReceipt = issuedInstitutionalReceipt(invoice);
        const canOperateInvoice = canOperateAnyInvoice || isOwn;
        const canOperateReceipt = canReprintAny || canVoid || canOperateAnyInvoice || isOwn;
        const canOpenInstitutionalReceipt = institutionalReceipt
          ? canViewReceipt
            && canOperateReceipt
            && (!hasInstitutionalPrintEvents(institutionalReceipt) || canReprint)
          : false;
        const canOpenLegacyReceipt = canViewReceipt
          && !institutionalReceipt
          && (canReprintAny || isOwn);
        const canOpenReceipt = canOpenInstitutionalReceipt || canOpenLegacyReceipt;
        const groups: ActionMenuGroup[] = [];

        const primaryGroup: ActionMenuGroup = {
          key: 'receipt',
          items: [],
        };
        if (canOpenReceipt) {
          const opensAuditedReprint = institutionalReceipt
            ? hasInstitutionalPrintEvents(institutionalReceipt)
            : false;
          primaryGroup.items.push({
            key: 'view',
            label: opensAuditedReprint ? 'Reimprimir PDF' : 'Ver recibo',
            icon: opensAuditedReprint
              ? <Printer aria-hidden="true" className="size-4" />
              : <Receipt aria-hidden="true" className="size-4" />,
            onSelect: () => onOpenReceipt(invoice.id),
          });
        }
        if (canOpenInstitutionalReceipt && institutionalReceipt) {
          primaryGroup.items.push({
            key: 'download',
            label: 'Descargar',
            icon: <Download aria-hidden="true" className="size-4" />,
            disabled: loadingActionInvoiceId === invoice.id,
            onSelect: () => onDownloadInstitutionalReceipt(invoice),
          });
        }
        if (canIssueInstitutionalReceipt && invoice.status === 'paid' && !institutionalReceipt) {
          primaryGroup.items.push({
            key: 'generate',
            label: 'Generar PDF',
            icon: <ReceiptText aria-hidden="true" className="size-4" />,
            disabled: loadingActionInvoiceId === invoice.id,
            onSelect: () => onGenerateInstitutionalReceipt(invoice.id),
          });
        }
        const hasReprintableReceipt = Boolean(institutionalReceipt) || invoice.status === 'paid' || invoice.status === 'partial';
        if (canReprint && (canReprintAny || isOwn) && hasReprintableReceipt) {
          primaryGroup.items.push({
            key: 'reprint',
            label: 'Reimprimir',
            icon: <Printer aria-hidden="true" className="size-4" />,
            onSelect: () => onReprint(invoice),
          });
        }
        if (primaryGroup.items.length > 0) {
          groups.push(primaryGroup);
        }

        const dangerGroup: ActionMenuGroup = { key: 'danger', items: [] };
        if (canReverse && canOperateInvoice && (invoice.status === 'paid' || invoice.status === 'partial')) {
          dangerGroup.items.push({
            key: 'reverse',
            label: 'Reversar pago',
            icon: <XCircle aria-hidden="true" className="size-4" />,
            destructive: true,
            onSelect: () => onPrepareInvoiceAction(invoice.id, 'reverse'),
          });
        }
        if (canVoid && canOperateInvoice && invoice.status === 'issued') {
          dangerGroup.items.push({
            key: 'void',
            label: 'Anular factura',
            icon: <XCircle aria-hidden="true" className="size-4" />,
            destructive: true,
            onSelect: () => onPrepareInvoiceAction(invoice.id, 'void'),
          });
        }
        if (dangerGroup.items.length > 0) {
          groups.push(dangerGroup);
        }

        if (groups.length === 0) {
          return null;
        }

        return (
          <ActionMenu
            ariaLabel={`Acciones de la factura ${invoice.invoice_number}`}
            groups={groups}
          />
        );
      },
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

function hasInstitutionalPrintEvents(receipt: NonNullable<Invoice['institutional_receipt']>): boolean {
  return receipt.has_print_events === true || (receipt.print_events_count ?? 0) > 0;
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

function ReceiptTrace({ invoice }: { invoice: Invoice }) {
  const receipt = issuedInstitutionalReceipt(invoice);

  if (receipt) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
          {receipt.receipt_number_full}
        </span>
        <span className="text-[11px] text-muted-foreground">PDF emitido</span>
      </span>
    );
  }

  if (invoice.status === 'paid' || invoice.status === 'partial') {
    return <span className="text-muted-foreground">PDF pendiente</span>;
  }

  if (invoice.status === 'void') {
    return <span className="text-muted-foreground">Anulada</span>;
  }

  return <span className="text-muted-foreground">Pendiente de pago</span>;
}
