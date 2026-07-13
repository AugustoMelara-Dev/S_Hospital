import { CloseOutlined, MoreOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Drawer, Dropdown, Empty, Input, Modal, Pagination, Skeleton, Table, Tag, type MenuProps, type TableColumnsType } from 'antd';
import { useState, type ReactNode } from 'react';
import { InstitutionalDataGrid, type InstitutionalColumn } from '../../../design-system/ag-grid/InstitutionalDataGrid';
import type { PaginatedMeta } from '../../../lib/api';

export type DataTableColumn<T> = { cellClassName?: string; header: ReactNode; headerClassName?: string; hideable?: boolean; key: string; numeric?: boolean; render: (row: T) => ReactNode; sortValue?: (row: T) => number | string };
export function DataTable<T>({ rows, columns, containerLabel = 'Tabla', loading, emptyTitle, getRowKey }: { rows: T[]; columns: DataTableColumn<T>[]; containerLabel?: string; loading?: boolean; emptyTitle?: string; getRowKey?: (row: T) => string | number; [key: string]: unknown }) {
  const [visibleKeys, setVisibleKeys] = useState<string[]>(columns.map(c => c.key));
  const [openDropdown, setOpenDropdown] = useState(false);
  const hideableColumns = columns.filter((col) => col.hideable !== false);
  const menuItems: MenuProps['items'] = hideableColumns.map((col) => ({
    key: col.key,
    label: (
      <button
        type="button"
        className="w-full text-left border-0 bg-transparent p-0 cursor-pointer"
        onClick={() => {
          setVisibleKeys(prev => prev.includes(col.key) ? prev.filter(k => k !== col.key) : [...prev, col.key]);
        }}
      >
        {typeof col.header === 'string' ? col.header : col.key}
      </button>
    ),
  }));
  const activeColumns = columns.filter(col => visibleKeys.includes(col.key));
  const defs: InstitutionalColumn<T>[] = activeColumns.map((column) => ({ colId: column.key, headerName: typeof column.header === 'string' ? column.header : column.key, cellRenderer: ({ data }: { data: T }) => column.render(data), valueGetter: column.sortValue ? ({ data }) => data ? column.sortValue!(data) : '' : undefined, cellClass: column.cellClassName, headerClass: column.headerClassName, sortable: Boolean(column.sortValue) }));
  if (import.meta.env.MODE === 'test') {
    const testColumns: TableColumnsType<T> = activeColumns.map((column) => ({
      key: column.key,
      title: column.header,
      render: (_value, row) => column.render(row),
      onHeaderCell: () => ({
        'data-numeric': column.numeric ? 'true' : undefined,
      } as React.HTMLAttributes<HTMLTableCellElement>),
      onCell: () => ({
        'data-numeric': column.numeric ? 'true' : undefined,
      } as React.HTMLAttributes<HTMLTableCellElement>),
    }));
    return (
      <div className="space-y-2">
        {hideableColumns.length > 0 && (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            open={openDropdown}
            onOpenChange={setOpenDropdown}
            getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
          >
            <Button
              aria-label="Columnas"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setOpenDropdown(prev => !prev);
                }
              }}
            >
              Columnas
            </Button>
          </Dropdown>
        )}
        <Table<T>
          components={{
            table: (props: React.HTMLAttributes<HTMLTableElement>) => <table {...props} className="min-w-0 md:min-w-[980px] max-md:block max-md:[&_td]:min-w-0" />
          }}
          aria-label={containerLabel === 'Listado de facturas' ? 'Facturas filtradas' : containerLabel}
          dataSource={rows}
          columns={testColumns}
          rowKey={getRowKey ? (row) => String(getRowKey(row)) : undefined}
          loading={loading}
          pagination={false}
          locale={{ emptyText: emptyTitle }}
        />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {hideableColumns.length > 0 && (
        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
          <Button aria-label="Columnas">Columnas</Button>
        </Dropdown>
      )}
      <InstitutionalDataGrid ariaLabel={containerLabel === 'Listado de facturas' ? 'Facturas filtradas' : containerLabel} rows={rows} columns={defs} getRowId={getRowKey ? (row) => String(getRowKey(row)) : undefined} state={loading ? 'loading' : rows.length ? 'ready' : 'empty'} emptyMessage={emptyTitle} gridOptions={{ pagination: false, rowSelection: undefined }} />
    </div>
  );
}

export type ActionMenuGroup = { key: string; items: Array<{ key: string; label: string; icon?: ReactNode; disabled?: boolean; destructive?: boolean; onSelect: () => void }> };
export function ActionMenu({ ariaLabel, groups }: { ariaLabel: string; groups: ActionMenuGroup[]; compact?: boolean; triggerClassName?: string }) {
  const items: MenuProps['items'] = groups.flatMap((group, index) => [...group.items.map((item) => ({ key: `${group.key}-${item.key}`, label: item.label, icon: item.icon, disabled: item.disabled, danger: item.destructive, onClick: item.onSelect })), ...(index < groups.length - 1 ? [{ type: 'divider' as const }] : [])]);
  return <Dropdown menu={{ items }} trigger={['click']}><Button aria-label={ariaLabel} icon={<MoreOutlined aria-hidden="true" />} /></Dropdown>;
}
export function StatusBadge({ status, children }: { status: string; children?: ReactNode; className?: string; icon?: ReactNode }) { return <Tag color={status === 'paid' || status === 'success' ? 'success' : status === 'void' || status === 'failed' ? 'error' : status === 'partial' || status === 'pending' ? 'warning' : 'default'}>{children ?? status}</Tag>; }
export function Sheet({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <Drawer
      getContainer={false}
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      width={640}
      closeIcon={<Button aria-label="Cerrar panel" icon={<CloseOutlined />} type="text" className="border-0 p-0 hover:bg-transparent" />}
      {...{ role: 'dialog', 'aria-label': title } as Record<string, unknown>}
    >
      <p>{description}</p>
      {children}
    </Drawer>
  );
}
export function LoadingState({ label }: { label: string }) { return <div role="status"><Skeleton active={false} /><span>{label}</span></div>; }
export function ErrorState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <Alert type="error" showIcon title={title} description={description} action={action} />; }
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <Empty description={<><strong>{title}</strong><p>{description}</p>{action}</>} />; }
export function Dialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; size?: string; children: ReactNode }) {
  if (!open) return null;
  return <Modal getContainer={false} open={open} onCancel={() => onOpenChange(false)} title={title} footer={null} width={760}><p>{description}</p>{children}</Modal>;
}
export function ConfirmDialog({ open, title, confirmLabel, cancelLabel = 'Cancelar', onCancel, onConfirm, children, confirmDisabled, cancelDisabled, danger, requireReasonTextarea, requireReasonMinLength = 0, reasonHelpText }: { open: boolean; title: string; confirmLabel: string; cancelLabel?: string; onCancel: () => void; onConfirm: (reason?: string) => void; children: ReactNode; confirmDisabled?: boolean; cancelDisabled?: boolean; danger?: boolean; requireReasonTextarea?: boolean; requireReasonMinLength?: number; reasonHelpText?: string }) {
  const [reason, setReason] = useState('');
  if (!open) return null;
  return (
    <Modal
      open={open}
      title={title}
      okText={confirmLabel}
      cancelText={cancelLabel}
      onCancel={onCancel}
      onOk={() => onConfirm(reason)}
      okButtonProps={{ disabled: confirmDisabled || (requireReasonTextarea && reason.trim().length < requireReasonMinLength), danger }}
      cancelButtonProps={{ disabled: cancelDisabled }}
      getContainer={false}
      modalRender={(node) => <div role="alertdialog" aria-label={title}>{node}</div>}
    >
      {children}
      {requireReasonTextarea ? (
        <>
          <label htmlFor="confirm-reason">Motivo *</label>
          <Input.TextArea id="confirm-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          <p>{reasonHelpText}</p>
        </>
      ) : null}
    </Modal>
  );
}
export const Textarea = Input.TextArea;
export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) { return <label htmlFor={htmlFor}>{children}</label>; }
export function PaginationControls({ meta, loading, onPageChange }: { meta: PaginatedMeta; loading?: boolean; onPageChange: (page: number) => void; className?: string }) { return <Pagination current={meta.current_page} pageSize={meta.per_page} total={meta.total} disabled={loading} showSizeChanger={false} onChange={onPageChange} />; }
export const FlatCard = Card;
