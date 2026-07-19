import type { MouseEvent } from 'react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PER_PAGE_OPTIONS, type CatalogPaginationProps } from './catalogTypes';

export function CatalogPagination({ isLoading, meta, perPage, servicesCount, onPageChange, onPerPageChange }: CatalogPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(meta.total / perPage));
  const pages = Array.from(new Set([1, meta.current_page - 1, meta.current_page, meta.current_page + 1, totalPages])).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const goTo = (event: MouseEvent<HTMLAnchorElement>, page: number) => { event.preventDefault(); if (!isLoading && page !== meta.current_page && page >= 1 && page <= totalPages) onPageChange(page); };
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
    <span aria-live="polite" className="text-sm text-muted-foreground">Mostrando {servicesCount} de {meta.total} servicios</span>
    <Select value={String(perPage)} onValueChange={(value) => onPerPageChange(Number(value))}><SelectTrigger aria-label="Servicios por página"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{PER_PAGE_OPTIONS.map((option) => <SelectItem key={option} value={String(option)}>{option} por pág.</SelectItem>)}</SelectGroup></SelectContent></Select>
    <Pagination aria-label="Paginación del catálogo" className="mx-0 w-auto"><PaginationContent><PaginationItem><PaginationPrevious href="#" text="Anterior" aria-label="Página anterior" aria-disabled={isLoading || meta.current_page === 1} tabIndex={isLoading || meta.current_page === 1 ? -1 : undefined} onClick={(event) => goTo(event, meta.current_page - 1)} /></PaginationItem>{pages.map((page) => <PaginationItem key={page}><PaginationLink href="#" aria-label={`Página ${page}`} isActive={page === meta.current_page} aria-disabled={isLoading} tabIndex={isLoading ? -1 : undefined} onClick={(event) => goTo(event, page)}>{page}</PaginationLink></PaginationItem>)}<PaginationItem><PaginationNext href="#" text="Siguiente" aria-label="Página siguiente" aria-disabled={isLoading || meta.current_page === totalPages} tabIndex={isLoading || meta.current_page === totalPages ? -1 : undefined} onClick={(event) => goTo(event, meta.current_page + 1)} /></PaginationItem></PaginationContent></Pagination>
  </div>;
}
