import type { CSSProperties, ReactNode } from 'react';
import {
  CellStyleModule,
  DateFilterModule,
  LocaleModule,
  NumberFilterModule,
  PaginationModule,
  RowSelectionModule,
  TextFilterModule,
  themeQuartz,
  type ColDef,
  type GetRowIdParams,
  type GridOptions,
} from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';

import './institutional-data-grid.css';

export type GridColorMode = 'light' | 'dark';
export type GridDensity = 'compact' | 'comfortable';
export type GridState = 'ready' | 'loading' | 'empty' | 'error';

export type InstitutionalColumn<TData> = ColDef<TData> & {
  priority?: 'primary' | 'secondary' | 'tertiary';
};

export type ColumnVisibilityConfig = {
  visibleColumnIds: readonly string[];
  requiredColumnIds?: readonly string[];
};

const modules = [
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  PaginationModule,
  RowSelectionModule,
  LocaleModule,
  CellStyleModule,
];

const localeText: Record<string, string> = {
  page: 'Página',
  more: 'Más',
  to: 'a',
  of: 'de',
  next: 'Siguiente',
  last: 'Última',
  first: 'Primera',
  previous: 'Anterior',
  loadingOoo: 'Cargando…',
  noRowsToShow: 'No hay registros',
  filterOoo: 'Filtrar…',
  equals: 'Igual a',
  notEqual: 'Distinto de',
  contains: 'Contiene',
  notContains: 'No contiene',
  startsWith: 'Comienza con',
  endsWith: 'Termina con',
  applyFilter: 'Aplicar',
  resetFilter: 'Restablecer',
  clearFilter: 'Limpiar',
};

const lightTheme = themeQuartz.withParams({
  accentColor: 'var(--institutional-primary)',
  backgroundColor: 'var(--color-background)',
  borderColor: 'var(--color-border)',
  borderRadius: 0,
  browserColorScheme: 'light',
  fontFamily: '"IBM Plex Sans Variable", system-ui, sans-serif',
  foregroundColor: 'var(--color-foreground)',
  headerBackgroundColor: 'var(--color-muted)',
  headerTextColor: 'var(--color-foreground)',
  wrapperBorderRadius: 0,
});

const darkTheme = themeQuartz.withParams({
  accentColor: 'var(--institutional-primary)',
  backgroundColor: 'var(--color-background)',
  borderColor: 'var(--color-border)',
  borderRadius: 0,
  browserColorScheme: 'dark',
  fontFamily: '"IBM Plex Sans Variable", system-ui, sans-serif',
  foregroundColor: 'var(--color-foreground)',
  headerBackgroundColor: 'var(--color-muted)',
  headerTextColor: 'var(--color-foreground)',
  wrapperBorderRadius: 0,
});

export function createInstitutionalGridOptions<TData>({ mode = 'light', density = 'comfortable' }: {
  mode?: GridColorMode;
  density?: GridDensity;
} = {}): GridOptions<TData> {
  return {
    theme: mode === 'dark' ? darkTheme : lightTheme,
    localeText,
    pagination: true,
    paginationPageSize: 25,
    paginationPageSizeSelector: [10, 25, 50, 100],
    rowHeight: density === 'compact' ? 32 : 40,
    headerHeight: density === 'compact' ? 32 : 40,
    animateRows: false,
    ensureDomOrder: true,
    suppressColumnVirtualisation: true,
    suppressCellFocus: false,
    rowSelection: { mode: 'multiRow', enableClickSelection: true, checkboxes: true, headerCheckbox: true },
    defaultColDef: { sortable: true, filter: true, resizable: true, minWidth: 96 },
  };
}

export interface InstitutionalDataGridProps<TData> {
  ariaLabel: string;
  regionAriaLabel?: string;
  gridAriaLabel?: string;
  caption?: ReactNode;
  description?: ReactNode;
  columns: InstitutionalColumn<TData>[];
  rows: TData[];
  getRowId: (row: TData) => string;
  columnVisibility?: ColumnVisibilityConfig;
  mode?: GridColorMode;
  density?: GridDensity;
  state?: GridState;
  errorMessage?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  height?: number | string;
  gridOptions?: Omit<GridOptions<TData>, 'columnDefs' | 'rowData' | 'theme'>;
  actions?: ReactNode;
}

export function InstitutionalDataGrid<TData>({
  ariaLabel,
  regionAriaLabel,
  gridAriaLabel,
  caption,
  description,
  columns,
  rows,
  getRowId,
  columnVisibility,
  mode = 'light',
  density = 'comfortable',
  state = rows.length === 0 ? 'empty' : 'ready',
  errorMessage = 'No se pudo cargar la información.',
  emptyMessage = 'No hay registros para mostrar.',
  loadingMessage = 'Cargando registros…',
  height = 420,
  gridOptions,
  actions,
}: InstitutionalDataGridProps<TData>) {
  const defaults = createInstitutionalGridOptions<TData>({ mode, density });
  const visibleColumnIds = columnVisibility
    ? new Set([...columnVisibility.visibleColumnIds, ...(columnVisibility.requiredColumnIds ?? [])])
    : null;
  const prioritizedColumns = columns.filter((column) => {
    if (!visibleColumnIds) return true;
    const columnId = column.colId ?? column.field;
    return columnId == null || visibleColumnIds.has(String(columnId));
  }).map((column) => ({
    ...column,
    cellClass: [column.cellClass, column.priority ? `institutional-grid__cell--${column.priority}` : undefined].filter(Boolean).join(' '),
    headerClass: [column.headerClass, column.priority ? `institutional-grid__header--${column.priority}` : undefined].filter(Boolean).join(' '),
  }));
  const style = { '--institutional-grid-height': typeof height === 'number' ? `${height}px` : height } as CSSProperties;
  const getRowIdAdapter = (params: GetRowIdParams<TData>) => getRowId(params.data);

  return (
    <section className={`institutional-grid institutional-grid--${mode} institutional-grid--${density}`} style={style} aria-label={regionAriaLabel ?? ariaLabel} aria-busy={state === 'loading'}>
      {caption || description ? (
        <div className="sr-only">
          {caption ? <p>{caption}</p> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      {actions ? <div className="institutional-grid__actions">{actions}</div> : null}
      {state !== 'ready' ? (
        <div className="institutional-grid__overlay" role={state === 'error' ? 'alert' : 'status'}>
          {state === 'loading' ? loadingMessage : state === 'error' ? errorMessage : emptyMessage}
        </div>
      ) : (
        <AgGridProvider modules={modules}>
          <AgGridReact<TData>
            {...defaults}
            {...gridOptions}
            columnDefs={prioritizedColumns}
            rowData={rows}
            getRowId={getRowIdAdapter}
            aria-label={gridAriaLabel ?? ariaLabel}
          />
        </AgGridProvider>
      )}
    </section>
  );
}
