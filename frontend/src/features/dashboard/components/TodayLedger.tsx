import { Descriptions, Typography } from 'antd';
import type { ReactNode } from 'react';

export type TodayLedgerItem = {
  id: string;
  label: string;
  value: ReactNode;
  note: string;
  tone: 'neutral' | 'success' | 'attention' | 'danger';
};

export function TodayLedger({ items }: { items: TodayLedgerItem[] }) {
  return (
    <section aria-label="Resumen financiero de hoy" className="border border-border bg-surface p-4">
      <h2 className="sr-only">Resumen financiero de hoy</h2>
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2, xl: 4 }}>
        {items.map((item) => (
          <Descriptions.Item key={item.id} label={item.label}>
            <Typography.Text strong>{item.value}</Typography.Text>
            <br />
            <Typography.Text type={item.tone === 'danger' ? 'danger' : item.tone === 'attention' ? 'warning' : 'secondary'}>
              {item.note}
            </Typography.Text>
          </Descriptions.Item>
        ))}
      </Descriptions>
    </section>
  );
}
