import { ExclamationCircleOutlined, RightOutlined } from '@ant-design/icons';
import { Button, List, Space, Tag, Typography } from 'antd';

export type OperationalQueueItem = {
  id: string;
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
  priority: 'normal' | 'attention' | 'danger';
};

const priorityLabel = { normal: 'Normal', attention: 'Atención', danger: 'Urgente' } as const;

// Colors sourced from Ant Design design token palette — no ad-hoc hex values.
const PRIORITY_TAG_COLOR: Record<OperationalQueueItem['priority'], string> = {
  normal:    'default',
  attention: 'warning',
  danger:    'error',
};

export function OperationalQueue({ items }: { items: OperationalQueueItem[] }) {
  return (
    <section aria-labelledby="operational-queue-title" className="min-w-0 border border-border bg-surface">
      <header className="border-b border-border px-5 py-4">
        <Typography.Text type="secondary">Prioridad del turno</Typography.Text>
        <Typography.Title id="operational-queue-title" level={2} className="m-0">Próxima acción</Typography.Title>
      </header>
      <List
        dataSource={items}
        className="px-5"
        renderItem={(item, index) => (
          <List.Item
            key={item.id}
            actions={item.href && item.actionLabel ? [
              <Button key="action" type="link" href={item.href} icon={<RightOutlined />} iconPlacement="end">{item.actionLabel}</Button>,
            ] : undefined}
          >
            <List.Item.Meta
              avatar={index === 0
                ? <ExclamationCircleOutlined aria-hidden="true" style={{ fontSize: '18px', marginTop: '4px' }} />
                : <Typography.Text type="secondary">{index + 1}</Typography.Text>}
              title={
                <Space>
                  <Typography.Text strong>{item.title}</Typography.Text>
                  <Tag color={PRIORITY_TAG_COLOR[item.priority]}>{priorityLabel[item.priority]}</Tag>
                </Space>
              }
              description={item.description}
            />
          </List.Item>
        )}
      />
    </section>
  );
}
