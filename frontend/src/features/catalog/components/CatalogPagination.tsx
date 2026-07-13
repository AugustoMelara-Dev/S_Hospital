import { Pagination, Select, Space, Typography } from 'antd';
import { PER_PAGE_OPTIONS, type CatalogPaginationProps } from './catalogTypes';

export function CatalogPagination({ isLoading, meta, perPage, servicesCount, onPageChange, onPerPageChange }: CatalogPaginationProps) {
  return (
    <Space wrap className="w-full justify-between border border-slate-300 p-3">
      <Typography.Text aria-live="polite">Mostrando {servicesCount} de {meta.total} servicios</Typography.Text>
      <Select value={String(perPage)} onChange={(value) => onPerPageChange(Number(value))} aria-label="Servicios por página" options={PER_PAGE_OPTIONS.map((option) => ({ value: String(option), label: `${option} por pág.` }))} />
      <Pagination disabled={isLoading} current={meta.current_page} pageSize={perPage} total={meta.total} showSizeChanger={false} onChange={onPageChange} />
    </Space>
  );
}
