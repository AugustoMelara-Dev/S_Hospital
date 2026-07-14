import { Pagination, Select, Space, Typography, type PaginationProps } from 'antd';
import { cloneElement, isValidElement, type ReactElement } from 'react';
import { PER_PAGE_OPTIONS, type CatalogPaginationProps } from './catalogTypes';

const accessiblePaginationItem: NonNullable<PaginationProps['itemRender']> = (_, type, originalElement) => {
  if ((type === 'prev' || type === 'next') && isValidElement(originalElement)) {
    return cloneElement(originalElement as ReactElement<Record<string, unknown>>, {
      'aria-label': type === 'prev' ? 'Página anterior' : 'Página siguiente',
    });
  }
  return originalElement;
};

export function CatalogPagination({ isLoading, meta, perPage, servicesCount, onPageChange, onPerPageChange }: CatalogPaginationProps) {
  return (
    <Space wrap className="w-full justify-between border border-slate-300 p-3">
      <Typography.Text aria-live="polite">Mostrando {servicesCount} de {meta.total} servicios</Typography.Text>
      <Select value={String(perPage)} onChange={(value) => onPerPageChange(Number(value))} aria-label="Servicios por página" options={PER_PAGE_OPTIONS.map((option) => ({ value: String(option), label: `${option} por pág.` }))} />
      <Pagination disabled={isLoading} current={meta.current_page} pageSize={perPage} total={meta.total} showSizeChanger={false} onChange={onPageChange} itemRender={accessiblePaginationItem} />
    </Space>
  );
}
