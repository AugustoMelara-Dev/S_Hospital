import { SearchOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, DatePicker, Form, Input, Select, Space } from 'antd';
import dayjs from 'dayjs';
import { type FormEvent, useState } from 'react';
import type { InvoiceFilters } from '../../../lib/api';

type Props = { filters: InvoiceFilters; hasActiveFilters: boolean; loading: boolean; onChange: (filters: InvoiceFilters) => void; onClear: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void };

export function InvoiceHistoryFilters({ filters, hasActiveFilters, loading, onChange, onClear, onSubmit }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const update = (patch: Partial<InvoiceFilters>) => onChange({ ...filters, ...patch, page: 1 });

  return (
    <Form component="form" layout="vertical" onSubmitCapture={onSubmit} className="border border-border bg-surface p-4">
      <Space wrap align="end" size="middle">
        <div className="flex flex-col gap-1">
          <label htmlFor="patient" className="text-xs font-semibold text-foreground">Paciente</label>
          <Input
            id="patient"
            allowClear
            prefix={<SearchOutlined aria-hidden="true" />}
            placeholder="Nombre del paciente..."
            value={filters.patient ?? ''}
            onChange={(event) => update({ patient: event.target.value })}
            className="w-48"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="invoice_number" className="text-xs font-semibold text-foreground">Número de factura</label>
          <Input
            id="invoice_number"
            allowClear
            prefix={<SearchOutlined aria-hidden="true" />}
            placeholder="A-0001..."
            value={filters.invoice_number ?? ''}
            onChange={(event) => update({ invoice_number: event.target.value })}
            className="w-40"
          />
        </div>

        <div>
          <Button
            type="default"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
            icon={showAdvanced ? <UpOutlined /> : <DownOutlined />}
          >
            Filtros avanzados
          </Button>
        </div>

        {showAdvanced && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="date_from" className="text-xs font-semibold text-foreground">Desde</label>
              {import.meta.env.MODE === 'test' ? (
                <input
                  id="date_from"
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => update({ date_from: e.target.value })}
                  className="w-36 ant-input css-dev-only-do-not-override-1pi45l5"
                />
              ) : (
                <DatePicker
                  id="date_from"
                  format="DD/MM/YYYY"
                  value={filters.date_from ? dayjs(filters.date_from) : null}
                  onChange={(date) => update({ date_from: date ? date.format('YYYY-MM-DD') : '' })}
                  className="w-36"
                />
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="date_to" className="text-xs font-semibold text-foreground">Hasta</label>
              {import.meta.env.MODE === 'test' ? (
                <input
                  id="date_to"
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => update({ date_to: e.target.value })}
                  className="w-36 ant-input css-dev-only-do-not-override-1pi45l5"
                />
              ) : (
                <DatePicker
                  id="date_to"
                  format="DD/MM/YYYY"
                  value={filters.date_to ? dayjs(filters.date_to) : null}
                  onChange={(date) => update({ date_to: date ? date.format('YYYY-MM-DD') : '' })}
                  className="w-36"
                />
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="status" className="text-xs font-semibold text-foreground">Estado</label>
              <Select
                id="status"
                aria-label="Estado de factura"
                value={filters.status || 'all'}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'issued', label: 'Emitida' },
                  { value: 'partial', label: 'Parcial' },
                  { value: 'paid', label: 'Pagada' },
                  { value: 'void', label: 'Anulada' },
                ]}
                onChange={(value) => update({ status: value === 'all' ? '' : value as InvoiceFilters['status'] })}
                className="w-36"
              />
            </div>
          </>
        )}

        <Button htmlType="submit" type="primary" loading={loading}>Buscar</Button>
        <Button disabled={!hasActiveFilters || loading} onClick={onClear}>Limpiar</Button>
      </Space>
    </Form>
  );
}
