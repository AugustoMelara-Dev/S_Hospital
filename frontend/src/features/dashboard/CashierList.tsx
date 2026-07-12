import { UserOutlined } from '@ant-design/icons';
import { Empty, List, Tag, Typography } from 'antd';
import { formatLempirasUI } from '../../lib/money';

type CashierSummary = { user_id: number; name: string; username: string; payment_count: number; total_collected: string };

export function CashierList({ cashiers }: { cashiers: CashierSummary[] }) {
  if (cashiers.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Ningún cajero ha recibido pagos hoy" />;

  return (
    <List dataSource={cashiers} renderItem={(cashier) => (
      <List.Item key={cashier.user_id} extra={<><Typography.Text strong>{formatLempirasUI(cashier.total_collected)}</Typography.Text><br /><Tag>{cashier.payment_count} {cashier.payment_count === 1 ? 'pago' : 'pagos'}</Tag></>}>
        <List.Item.Meta avatar={<UserOutlined aria-hidden="true" />} title={cashier.name} description={`@${cashier.username}`} />
      </List.Item>
    )} />
  );
}
