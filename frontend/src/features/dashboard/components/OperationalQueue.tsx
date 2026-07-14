import { ExclamationCircleOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Flex, Space, Tag, Typography } from 'antd';

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
      <Flex vertical role="list" className="px-5">
        {items.map((item, index) => (
          <Flex key={item.id} role="listitem" justify="space-between" align="start" gap="middle" className="border-b border-border py-4 last:border-b-0">
            <Flex align="start" gap="middle">
              {index === 0
                ? <ExclamationCircleOutlined aria-hidden="true" className="mt-1 text-lg" />
                : <Typography.Text type="secondary">{index + 1}</Typography.Text>}
              <Flex vertical gap="small">
                <Space>
                  <Typography.Text strong>{item.title}</Typography.Text>
                  <Tag color={PRIORITY_TAG_COLOR[item.priority]}>{priorityLabel[item.priority]}</Tag>
                </Space>
                <Typography.Text type="secondary">{item.description}</Typography.Text>
              </Flex>
            </Flex>
            {item.href && item.actionLabel ? (
              <Button type="link" href={item.href} icon={<RightOutlined />} iconPlacement="end">{item.actionLabel}</Button>
            ) : null}
          </Flex>
        ))}
      </Flex>
    </section>
  );
}
