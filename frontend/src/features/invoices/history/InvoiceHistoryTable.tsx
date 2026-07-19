import { BanknoteIcon, DownloadIcon as Download, PrinterIcon as Printer, ReceiptIcon as Receipt, FileTextIcon as ReceiptText, UserIcon as User, CircleXIcon as XCircle, MoreHorizontalIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DataTable, type InstitutionalColumn } from '@/design-system/patterns/DataTable';
import type { Invoice } from '../../../lib/api';
import {
  getIssuedInstitutionalReceipt,
  invoiceActionPolicy,
} from '../../../modules/invoices/application/invoiceActionPolicy';

type InvoiceHistoryTableProps = {
  canIssueInstitutionalReceipt: boolean;
  canCollectPayment: boolean;
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
  onCollectPayment: (invoice: Invoice) => void;
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

export type ActionMenuGroup = {
  key: string;
  items: Array<{
    key: string;
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
    destructive?: boolean;
    onSelect: () => void;
  }>;
};

export function ActionMenu({ ariaLabel, groups }: { ariaLabel: string; groups: ActionMenuGroup[] }) {
  return (
    <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={ariaLabel}><MoreHorizontalIcon aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{groups.map((group, index) => <div key={group.key}>{index > 0 ? <DropdownMenuSeparator /> : null}{group.items.map((item) => <DropdownMenuItem key={item.key} disabled={item.disabled} variant={item.destructive ? 'destructive' : 'default'} onSelect={item.onSelect}>{item.icon}{item.label}</DropdownMenuItem>)}</div>)}</DropdownMenuContent></DropdownMenu>
  );
}

export function InvoiceHistoryTable(props: InvoiceHistoryTableProps) {
  const {
    formatDate,
    invoices,
    moneyLabel,
    onOpenDetail,
  } = props;
  const isMobile = useMobileInvoiceList();
  const [visibleKeys, setVisibleKeys] = useState<string[]>([
    'invoice_number',
    'issued_at',
    'patient_name',
    'total',
    'balance_due',
    'status',
    'receipt',
    'actions',
  ]);
  const hideableColumns = [
    { key: 'issued_at', label: 'Fecha' },
    { key: 'total', label: 'Total' },
    { key: 'paid_amount', label: 'Pagado' },
    { key: 'balance_due', label: 'Saldo' },
    { key: 'status', label: 'Estado' },
    { key: 'receipt', label: 'Recibo' },
  ];

  const setColumnVisible = (columnKey: string, visible: boolean) => {
    setVisibleKeys((current) => visible
      ? Array.from(new Set([...current, columnKey]))
      : current.filter((key) => key !== columnKey));
  };

  const allColumns: Array<InstitutionalColumn<Invoice>> = [
    { id: 'invoice_number', accessorKey: 'invoice_number', header: 'Factura', cell: ({ row }) => <div className="flex items-start gap-2"><ReceiptText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><Button type="button" variant="link" data-invoice-detail-trigger={row.original.id} className="min-h-9 px-0 text-left font-semibold text-foreground" aria-label={`Ver detalle de la factura ${row.original.invoice_number}`} onClick={(event) => onOpenDetail(row.original, event.currentTarget)}>{row.original.invoice_number}</Button></div> },
    { id: 'issued_at', accessorKey: 'issued_at', header: 'Fecha', cell: ({ row }) => formatDate(row.original.issued_at) },
    { id: 'patient_name', accessorKey: 'patient_name', header: 'Paciente', cell: ({ row }) => <div className="flex items-start gap-2"><User aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>{patientNameLabel(row.original)}</span></div> },
    { id: 'total', accessorKey: 'total', header: 'Total', meta: { numeric: true }, cell: ({ row }) => <span className="font-mono tabular-nums">{moneyLabel(row.original.total)}</span> },
    { id: 'paid_amount', accessorKey: 'paid_amount', header: 'Pagado', meta: { numeric: true }, cell: ({ row }) => <span className="font-mono tabular-nums">{moneyLabel(row.original.paid_amount)}</span> },
    { id: 'balance_due', accessorKey: 'balance_due', header: 'Saldo', meta: { numeric: true }, cell: ({ row }) => <span className={`font-mono tabular-nums ${row.original.status === 'partial' || row.original.status === 'issued' ? 'font-semibold text-warning' : ''}`}>{moneyLabel(row.original.balance_due)}</span> },
    { id: 'status', accessorKey: 'status', header: 'Estado', cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} /> },
    { id: 'receipt', header: 'Recibo', enableSorting: false, cell: ({ row }) => <ReceiptTrace invoice={row.original} /> },
    { id: 'actions', header: 'Acciones', enableSorting: false, cell: ({ row }) => <InvoiceRowActions invoice={row.original} tableProps={props} /> },
  ];
  const columns = allColumns.filter((column) => ['invoice_number', 'patient_name', 'actions'].includes(String(column.id)) || visibleKeys.includes(String(column.id)));

  if (isMobile) {
    return <InvoiceHistoryMobileList tableProps={props} />;
  }

  return (
    <div className="space-y-2">
      {hideableColumns.length > 0 && (
        <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" aria-label="Configurar columnas de facturas">Columnas</Button></DropdownMenuTrigger><DropdownMenuContent aria-label="Visibilidad de columnas del historial">{hideableColumns.map((column) => <DropdownMenuCheckboxItem key={column.key} checked={visibleKeys.includes(column.key)} onCheckedChange={(checked) => setColumnVisible(column.key, checked === true)}>{column.label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu>
      )}
      <section aria-label="Tabla de facturas">
        <DataTable
          ariaLabel="Facturas filtradas"
          data={invoices}
          columns={columns}
          getRowId={(invoice) => String(invoice.id)}
          emptyTitle="No hay registros para mostrar."
        />
      </section>
    </div>
  );
}

function useMobileInvoiceList() {
  const query = '(max-width: 767px)';
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches));

  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return matches;
}

function InvoiceHistoryMobileList({ tableProps }: { tableProps: InvoiceHistoryTableProps }) {
  const { formatDate, invoices, moneyLabel, onOpenDetail } = tableProps;

  return (
    <ul aria-label="Facturas filtradas en móvil" className="min-w-0 divide-y divide-border">
      {invoices.map((invoice) => (
        <li key={invoice.id} className="min-w-0 overflow-visible p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <Button
              type="button"
              variant="link"
              data-invoice-detail-trigger={invoice.id}
              className="min-h-11 min-w-0 break-all text-left font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`Ver detalle de la factura ${invoice.invoice_number}`}
              onClick={(event) => onOpenDetail(invoice, event.currentTarget as HTMLButtonElement)}
            >
              {invoice.invoice_number}
            </Button>
            <InvoiceRowActions invoice={invoice} tableProps={tableProps} />
          </div>
          <p className="mt-1 break-words text-sm text-foreground">{patientNameLabel(invoice)}</p>
          <p className="text-xs text-muted-foreground">{formatDate(invoice.issued_at)}</p>
          <dl className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <MobileValue label="Total" value={moneyLabel(invoice.total)} />
            <MobileValue label="Pagado" value={moneyLabel(invoice.paid_amount)} />
            <MobileValue label="Saldo" value={moneyLabel(invoice.balance_due)} emphasize={invoice.status === 'partial' || invoice.status === 'issued'} />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Estado</dt>
              <dd className="mt-1"><InvoiceStatusBadge status={invoice.status} /></dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-xs text-muted-foreground">Recibo</dt>
              <dd className="mt-1 break-words"><ReceiptTrace invoice={invoice} /></dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function MobileValue({ emphasize = false, label, value }: { emphasize?: boolean; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`break-words tabular-nums ${emphasize ? 'font-semibold text-warning' : 'text-foreground'}`}>{value}</dd>
    </div>
  );
}

function InvoiceRowActions({ invoice, tableProps }: { invoice: Invoice; tableProps: InvoiceHistoryTableProps }) {
  const {
    canIssueInstitutionalReceipt,
    canCollectPayment,
    canOperateAnyInvoice,
    canReprint,
    canReprintAny,
    canReverse,
    canViewReceipt,
    canVoid,
    isOwnInvoiceFromToday,
    loadingActionInvoiceId,
    onDownloadInstitutionalReceipt,
    onCollectPayment,
    onGenerateInstitutionalReceipt,
    onOpenReceipt,
    onPrepareInvoiceAction,
    onReprint,
  } = tableProps;
  const institutionalReceipt = issuedInstitutionalReceipt(invoice);
  const actions = invoiceActionPolicy(invoice, {
    canIssueInstitutionalReceipt,
    canCollectPayment,
    canOperateAnyInvoice,
    canReprint,
    canReprintAny,
    canReverse,
    canViewReceipt,
    canVoid,
    isOwnInvoiceFromToday: isOwnInvoiceFromToday(invoice),
  });
  const groups: ActionMenuGroup[] = [];
  const primaryGroup: ActionMenuGroup = { key: 'receipt', items: [] };

  if (actions.collectPayment) {
    primaryGroup.items.push({
      key: 'collect',
      label: 'Cobrar',
      icon: <BanknoteIcon aria-hidden="true" className="size-4" />,
      onSelect: () => onCollectPayment(invoice),
    });
  }

  if (actions.openReceipt) {
    primaryGroup.items.push({
      key: 'view',
      label: 'Ver recibo',
      icon: <Receipt aria-hidden="true" className="size-4" />,
      onSelect: () => onOpenReceipt(invoice.id),
    });
  }
  if (actions.downloadInstitutionalReceipt && institutionalReceipt) {
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
  if (primaryGroup.items.length > 0) groups.push(primaryGroup);

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
  if (dangerGroup.items.length > 0) groups.push(dangerGroup);
  if (groups.length === 0) return null;

  return <ActionMenu ariaLabel={`Acciones de la factura ${invoice.invoice_number}`} groups={groups} />;
}

export function issuedInstitutionalReceipt(invoice: Invoice): NonNullable<Invoice['institutional_receipt']> | null {
  return getIssuedInstitutionalReceipt(invoice);
}

function InvoiceStatusBadge({ status }: { status: Invoice['status'] }) {
  const label = status === 'paid' ? 'Pagada' : status === 'void' ? 'Anulada' : status === 'partial' ? 'Parcial' : 'Emitida';
  return <Badge variant={status === 'void' ? 'destructive' : status === 'paid' ? 'default' : 'secondary'}>{label}</Badge>;
}

function ReceiptTrace({ invoice }: { invoice: Invoice }) {
  const receipt = issuedInstitutionalReceipt(invoice);

  if (receipt) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
          {receipt.receipt_number_full}
        </span>
        <span className="text-xs text-muted-foreground">PDF emitido</span>
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
