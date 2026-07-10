import { Download, Printer, Receipt, ReceiptText, User, XCircle } from 'lucide-react';
import { ActionMenu, type ActionMenuGroup } from '../../../components/ui/action-menu';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import type { Invoice } from '../../../lib/api';
import {
  getIssuedInstitutionalReceipt,
  invoiceActionPolicy,
} from '../../../modules/invoices/application/invoiceActionPolicy';

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
  onOpenDetail: (invoice: Invoice, trigger: HTMLButtonElement) => void;
  onPrepareInvoiceAction: (invoiceId: number, action: 'void' | 'reverse') => void;
  onReprint: (invoice: Invoice) => void;
};

function patientNameLabel(invoice: Invoice) {
  const patientName = invoice.patient_name.trim();
  return patientName ? patientName : 'Paciente sin nombre';
}

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
  onOpenDetail,
  onPrepareInvoiceAction,
  onReprint,
}: InvoiceHistoryTableProps) {
  const columns: Array<DataTableColumn<Invoice>> = [
    {
      key: 'invoice_number',
      header: 'Factura',
      cellClassName: "max-w-56 break-words text-sm font-semibold tabular-nums max-md:col-span-2 max-md:flex max-md:items-center max-md:gap-2 max-md:before:text-xs max-md:before:font-normal max-md:before:text-muted-foreground max-md:before:content-['Factura']",
      hideable: false,
      render: (invoice) => (
        <div className="flex items-start gap-2">
          <ReceiptText data-icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-secondary" />
          <button
            type="button"
            data-invoice-detail-trigger={invoice.id}
            className="min-h-11 rounded-sm text-left font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-9"
            aria-label={`Ver detalle de la factura ${invoice.invoice_number}`}
            onClick={(event) => onOpenDetail(invoice, event.currentTarget)}
          >
            {invoice.invoice_number}
          </button>
        </div>
      ),
    },
    {
      key: 'issued_at',
      header: 'Fecha',
      cellClassName: "whitespace-nowrap max-md:flex max-md:flex-col max-md:before:text-xs max-md:before:text-muted-foreground max-md:before:content-['Fecha']",
      render: (invoice) => formatDate(invoice.issued_at),
    },
    {
      key: 'patient_name',
      header: 'Paciente',
      cellClassName: "max-w-60 break-words font-medium max-md:col-span-2 max-md:flex max-md:flex-col max-md:before:text-xs max-md:before:font-normal max-md:before:text-muted-foreground max-md:before:content-['Paciente']",
      hideable: false,
      render: (invoice) => (
        <div className="flex items-start gap-2">
          <User data-icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{patientNameLabel(invoice)}</span>
        </div>
      ),
    },
    { key: 'total', header: 'Total', numeric: true, cellClassName: "max-md:flex max-md:flex-col max-md:items-start max-md:text-left max-md:before:text-xs max-md:before:text-muted-foreground max-md:before:content-['Total']", render: (invoice) => moneyLabel(invoice.total) },
    { key: 'paid_amount', header: 'Pagado', numeric: true, cellClassName: "max-md:flex max-md:flex-col max-md:items-start max-md:text-left max-md:before:text-xs max-md:before:text-muted-foreground max-md:before:content-['Pagado']", render: (invoice) => moneyLabel(invoice.paid_amount) },
    {
      key: 'balance_due',
      header: 'Saldo',
      numeric: true,
      cellClassName: "max-md:flex max-md:flex-col max-md:items-start max-md:text-left max-md:before:text-xs max-md:before:text-muted-foreground max-md:before:content-['Saldo']",
      render: (invoice) => (
        <span className={invoice.status === 'partial' || invoice.status === 'issued' ? 'font-semibold text-warning-foreground' : undefined}>
          {moneyLabel(invoice.balance_due)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      cellClassName: "max-md:flex max-md:flex-col max-md:items-start max-md:before:text-xs max-md:before:text-muted-foreground max-md:before:content-['Estado']",
      render: (invoice) => <InvoiceStatusBadge status={invoice.status} />,
    },
    {
      key: 'receipt',
      header: 'Recibo',
      cellClassName: "max-w-48 break-words text-xs max-md:col-span-2 max-md:flex max-md:flex-col max-md:before:text-xs max-md:before:text-muted-foreground max-md:before:content-['Recibo']",
      render: (invoice) => <ReceiptTrace invoice={invoice} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: "text-right max-md:col-span-2 max-md:flex max-md:justify-end",
      hideable: false,
      render: (invoice) => {
        const isOwn = isOwnInvoiceFromToday(invoice);
        const institutionalReceipt = issuedInstitutionalReceipt(invoice);
        const actions = invoiceActionPolicy(invoice, {
          canIssueInstitutionalReceipt,
          canOperateAnyInvoice,
          canReprint,
          canReprintAny,
          canReverse,
          canViewReceipt,
          canVoid,
          isOwnInvoiceFromToday: isOwn,
        });
        const groups: ActionMenuGroup[] = [];

        const primaryGroup: ActionMenuGroup = {
          key: 'receipt',
          items: [],
        };
        if (actions.openReceipt) {
          primaryGroup.items.push({
            key: 'view',
            label: actions.auditedOpen ? 'Reimprimir PDF' : 'Ver recibo',
            icon: actions.auditedOpen
              ? <Printer aria-hidden="true" className="size-4" />
              : <Receipt aria-hidden="true" className="size-4" />,
            onSelect: () => onOpenReceipt(invoice.id),
          });
        }
        if (
          actions.downloadInstitutionalReceipt
          && institutionalReceipt
        ) {
          primaryGroup.items.push({
            key: 'download',
            label: 'Descargar',
            icon: <Download aria-hidden="true" className="size-4" />,
            disabled: loadingActionInvoiceId === invoice.id,
            onSelect: () => onDownloadInstitutionalReceipt(invoice),
          });
        }
        if (actions.generateInstitutionalReceipt) {
          primaryGroup.items.push({
            key: 'generate',
            label: 'Generar PDF',
            icon: <ReceiptText aria-hidden="true" className="size-4" />,
            disabled: loadingActionInvoiceId === invoice.id,
            onSelect: () => onGenerateInstitutionalReceipt(invoice.id),
          });
        }
        if (actions.reprint) {
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
        if (actions.reverse) {
          dangerGroup.items.push({
            key: 'reverse',
            label: 'Reversar pago',
            icon: <XCircle aria-hidden="true" className="size-4" />,
            destructive: true,
            onSelect: () => onPrepareInvoiceAction(invoice.id, 'reverse'),
          });
        }
        if (actions.void) {
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
      tableClassName="w-full min-w-0 md:min-w-[980px] max-md:block max-md:[&_thead]:sr-only max-md:[&_tbody]:grid max-md:[&_tbody]:gap-3 max-md:[&_tr]:grid max-md:[&_tr]:grid-cols-2 max-md:[&_tr]:rounded-md max-md:[&_tr]:border max-md:[&_tr]:border-border max-md:[&_tr]:bg-card max-md:[&_tr]:p-3 max-md:[&_td]:min-w-0 max-md:[&_td]:border-0 max-md:[&_td]:p-1.5"
      rows={invoices}
      columns={columns}
      getRowKey={(invoice) => invoice.id}
      showColumnVisibility
    />
  );
}

export function issuedInstitutionalReceipt(invoice: Invoice): NonNullable<Invoice['institutional_receipt']> | null {
  return getIssuedInstitutionalReceipt(invoice);
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
    return <span className="text-muted-foreground">Recibo pendiente</span>;
  }

  if (invoice.status === 'void') {
    return <span className="text-muted-foreground">Anulada</span>;
  }

  return <span className="text-muted-foreground">Pendiente de pago</span>;
}
