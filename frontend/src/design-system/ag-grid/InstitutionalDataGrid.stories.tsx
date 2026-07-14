import type { Meta, StoryObj } from '@storybook/react-vite';
import { InstitutionalDataGrid } from './InstitutionalDataGrid';

type Row = { id: string; service: string; price: number; status: string };
const rows: Row[] = [
  { id: '1', service: 'Consulta general', price: 250, status: 'Activo' },
  { id: '2', service: 'Hemograma completo', price: 180, status: 'Activo' },
];
const columns = [
  { field: 'service' as const, headerName: 'Servicio', flex: 1, priority: 'primary' as const },
  { field: 'price' as const, headerName: 'Precio', valueFormatter: ({ value }: { value: number }) => `L ${value.toFixed(2)}` },
  { field: 'status' as const, headerName: 'Estado' },
];

const meta = { component: InstitutionalDataGrid<Row>, args: { ariaLabel: 'Servicios', columns, rows, getRowId: (row: Row) => row.id } } satisfies Meta<typeof InstitutionalDataGrid<Row>>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = { args: { state: 'loading' } };
export const Empty: Story = { args: { rows: [], state: 'empty' } };
export const Error: Story = { args: { state: 'error' } };
export const Dark: Story = { args: { mode: 'dark' } };
export const LongData: Story = { args: { rows: Array.from({ length: 100 }, (_, index) => ({ id: String(index), service: `Servicio hospitalario ${index + 1}`, price: 100 + index, status: index % 3 ? 'Activo' : 'Inactivo' })) } };
