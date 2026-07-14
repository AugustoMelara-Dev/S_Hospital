import type { Meta, StoryObj } from '@storybook/react-vite';
import { InstitutionalChart } from './InstitutionalChart';

const option = {
  xAxis: { type: 'category' as const, data: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'] },
  yAxis: { type: 'value' as const },
  tooltip: { trigger: 'axis' as const },
  series: [{ type: 'line' as const, name: 'Cobros', data: [1200, 980, 1540, 1320, 1680] }],
};

const meta = { component: InstitutionalChart, args: { ariaLabel: 'Cobros de la semana', option, summary: 'La mayor recaudación ocurrió el viernes.' } } satisfies Meta<typeof InstitutionalChart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = { args: { state: 'loading' } };
export const Empty: Story = { args: { state: 'empty' } };
export const Error: Story = { args: { state: 'error' } };
export const Dark: Story = { args: { mode: 'dark' } };
export const LongData: Story = { args: { option: { ...option, xAxis: { type: 'category', data: Array.from({ length: 31 }, (_, index) => `${index + 1} jul`) }, series: [{ type: 'bar', name: 'Cobros', data: Array.from({ length: 31 }, (_, index) => 800 + index * 37) }] } } };
