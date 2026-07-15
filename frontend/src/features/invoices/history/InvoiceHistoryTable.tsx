import { DollarOutlined, DownloadOutlined as Download, PrinterOutlined as Printer, FileDoneOutlined as Receipt, FileTextOutlined as ReceiptText, UserOutlined as User, CloseCircleOutlined as XCircle, MoreOutlined } from '@ant-design/icons';
import { Button, Dropdown, Tag } from 'antd';
import type { MenuProps } from 'antd';
import { type ReactNode, useEffect, useState } from 'react';
import { InstitutionalDataGrid, type InstitutionalColumn } from '@/design-system/ag-grid/InstitutionalDataGrid';
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
  const items: MenuProps['items'] = groups.flatMap((group, index) => [
    ...group.items.map((item) => ({
      key: `${group.key}-${item.key}`,
      label: item.label,
      icon: item.icon,
      disabled: item.disabled,
      danger: item.destructive,
      onClick: item.onSelect,
    })),
    ...(index < groups.length - 1 ? [{ type: 'divider' as const }] : []),
  ]);

  return (
    <Dropdown menu={{ items }} trigger={['click']}>
      <Button className="min-h-11 min-w-11" aria-label={ariaLabel} icon={<MoreOutlined aria-hidden="true" />} />
    </Dropdown>
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

  const menuItems: MenuProps['items'] = hideableColumns.map((column) => ({
    key: column.key,
    label: column.label,
  }));

  const setColumnVisible = (columnKey: string, visible: boolean) => {
    setVisibleKeys((current) => visible
      ? Array.from(new Set([...current, columnKey]))
      : current.filter((key) => key !== columnKey));
  };

  const allColumns: InstitutionalColumn<Invoice>[] = [
    {
      colId: 'invoice_number',
      headerName: 'Factura',
      width: 205,
      cellRenderer: ({ data }: { data?: Invoice }) => {
        if (!data) return null;
        return (
          <div className="flex items-start gap-2">
            <ReceiptText data-icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-secondary" />
            <button
              type="button"
              data-invoice-detail-trigger={data.id}
              className="min-h-11 text-left font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-9"
              aria-label={`Ver detalle de la factura ${data.invoice_number}`}
              onClick={(event) => onOpenDetail(data, event.currentTarget)}
            >
              {data.invoice_number}
            </button>
          </div>
        );
      },
    },
    {
      colId: 'issued_at',
      headerName: 'Fecha',
      width: 160,
      cellRenderer: ({ data }: { data?: Invoice }) => data ? formatDate(data.issued_at) : null,
    },
    {
      colId: 'patient_name',
      headerName: 'Paciente',
      flex: 1,
      minWidth: 160,
      cellRenderer: ({ data }: { data?: Invoice }) => {
        if (!data) return null;
        return (
          <div className="flex items-start gap-2">
            <User data-icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{patientNameLabel(data)}</span>
          </div>
        );
      },
    },
    {
      colId: 'total',
      headerName: 'Total',
      width: 105,
      cellClass: 'tabular-nums',
      type: 'rightAligned',
      cellRenderer: ({ data }: { data?: Invoice }) => data ? moneyLabel(data.total) : null,
    },
    {
      colId: 'paid_amount',
      headerName: 'Pagado',
      width: 105,
      cellClass: 'tabular-nums',
      type: 'rightAligned',
      cellRenderer: ({ data }: { data?: Invoice }) => data ? moneyLabel(data.paid_amount) : null,
    },
    {
      colId: 'balance_due',
      headerName: 'Saldo',
      width: 105,
      cellClass: 'tabular-nums',
      type: 'rightAligned',
      cellRenderer: ({ data }: { data?: Invoice }) => {
        if (!data) return null;
        return (
          <span className={data.status === 'partial' || data.status === 'issued' ? 'font-semibold text-warning' : undefined}>
            {moneyLabel(data.balance_due)}
          </span>
        );
      },
    },
    {
      colId: 'status',
      headerName: 'Estado',
      width: 90,
      cellRenderer: ({ data }: { data?: Invoice }) => data ? <InvoiceStatusBadge status={data.status} /> : null,
    },
    {
      colId: 'receipt',
      headerName: 'Recibo',
      width: 180,
      cellRenderer: ({ data }: { data?: Invoice }) => data ? <ReceiptTrace invoice={data} /> : null,
    },
    {
      colId: 'actions',
      headerName: 'Acciones',
      width: 90,
      minWidth: 90,
      maxWidth: 90,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: { data?: Invoice }) => {
        if (!data) return null;
        return <InvoiceRowActions invoice={data} tableProps={props} />;
      },
    },
  ];

  if (isMobile) {
    return <InvoiceHistoryMobileList tableProps={props} />;
  }

  return (
    <div className="space-y-2">
      {hideableColumns.length > 0 && (
        <Dropdown
          menu={{
            'aria-label': 'Visibilidad de columnas del historial',
            items: menuItems,
            multiple: true,
            selectable: true,
            selectedKeys: visibleKeys.filter((key) => hideableColumns.some((column) => column.key === key)),
            onSelect: ({ key }) => setColumnVisible(key, true),
            onDeselect: ({ key }) => setColumnVisible(key, false),
          }}
          trigger={['click']}
        >
          <Button aria-label="Configurar columnas de facturas">
            Columnas
          </Button>
        </Dropdown>
      )}
      <InstitutionalDataGrid
        ariaLabel="Listado de facturas"
        regionAriaLabel="Tabla de facturas"
        gridAriaLabel="Facturas filtradas"
        caption="Facturas filtradas"
        description="Resultados del historial con acciones y columnas configurables."
        rows={invoices}
        columns={allColumns}
        getRowId={(invoice) => String(invoice.id)}
        columnVisibility={{
          visibleColumnIds: visibleKeys,
          requiredColumnIds: ['invoice_number', 'patient_name', 'actions'],
        }}
        state={invoices.length ? 'ready' : 'empty'}
        emptyMessage="No hay registros para mostrar."
        loadingMessage="Cargando facturas..."
        errorMessage="No se pudo cargar el historial de facturas."
      />
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
            <button
              type="button"
              data-invoice-detail-trigger={invoice.id}
              className="min-h-11 min-w-0 break-all text-left font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`Ver detalle de la factura ${invoice.invoice_number}`}
              onClick={(event) => onOpenDetail(invoice, event.currentTarget)}
            >
              {invoice.invoice_number}
            </button>
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
      icon: <DollarOutlined aria-hidden="true" className="size-4" />,
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
  const color = status === 'paid' ? 'success' : status === 'void' ? 'error' : status === 'partial' ? 'warning' : 'processing';
  const label = status === 'paid' ? 'Pagada' : status === 'void' ? 'Anulada' : status === 'partial' ? 'Parcial' : 'Emitida';
  return <Tag color={color}>{label}</Tag>;
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
