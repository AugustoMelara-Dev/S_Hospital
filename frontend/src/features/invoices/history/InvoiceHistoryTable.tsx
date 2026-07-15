import { DownloadOutlined as Download, PrinterOutlined as Printer, FileDoneOutlined as Receipt, FileTextOutlined as ReceiptText, UserOutlined as User, CloseCircleOutlined as XCircle, MoreOutlined } from '@ant-design/icons';
import { Button, Dropdown, Tag } from 'antd';
import type { MenuProps } from 'antd';
import { type ReactNode, useState } from 'react';
import { InstitutionalDataGrid, type InstitutionalColumn } from '@/design-system/ag-grid/InstitutionalDataGrid';
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
      <Button aria-label={ariaLabel} icon={<MoreOutlined aria-hidden="true" />} />
    </Dropdown>
  );
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
      width: 165,
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
      width: 145,
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
        const isOwn = isOwnInvoiceFromToday(data);
        const institutionalReceipt = issuedInstitutionalReceipt(data);
        const actions = invoiceActionPolicy(data, {
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
            onSelect: () => onOpenReceipt(data.id),
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
            disabled: loadingActionInvoiceId === data.id,
            onSelect: () => onDownloadInstitutionalReceipt(data),
          });
        }
        if (actions.generateInstitutionalReceipt) {
          primaryGroup.items.push({
            key: 'generate',
            label: 'Generar PDF',
            icon: <ReceiptText aria-hidden="true" className="size-4" />,
            disabled: loadingActionInvoiceId === data.id,
            onSelect: () => onGenerateInstitutionalReceipt(data.id),
          });
        }
        if (actions.reprint) {
          primaryGroup.items.push({
            key: 'reprint',
            label: 'Reimprimir',
            icon: <Printer aria-hidden="true" className="size-4" />,
            onSelect: () => onReprint(data),
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
            onSelect: () => onPrepareInvoiceAction(data.id, 'reverse'),
          });
        }
        if (actions.void) {
          dangerGroup.items.push({
            key: 'void',
            label: 'Anular factura',
            icon: <XCircle aria-hidden="true" className="size-4" />,
            destructive: true,
            onSelect: () => onPrepareInvoiceAction(data.id, 'void'),
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
            ariaLabel={`Acciones de la factura ${data.invoice_number}`}
            groups={groups}
          />
        );
      },
    },
  ];

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
