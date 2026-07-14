import { BankOutlined, CreditCardOutlined, DollarOutlined, WalletOutlined } from '@ant-design/icons';
import { Descriptions } from 'antd';
import { formatLempirasUI } from '@/lib/money';

type Props = { paymentsByMethod?: { cash: string; transfer: string; card: string; other: string }; paymentsCount?: number; pendingAmount?: string };
const methods = [{ key: 'cash', label: 'Efectivo', icon: <DollarOutlined /> }, { key: 'transfer', label: 'Transferencia', icon: <BankOutlined /> }, { key: 'card', label: 'Tarjeta', icon: <CreditCardOutlined /> }, { key: 'other', label: 'Otros', icon: <WalletOutlined /> }] as const;
export function CashMethodSummary({ paymentsByMethod, paymentsCount = 0, pendingAmount = '0.00' }: Props) {
  if (!paymentsByMethod) return null;
  return <section className="border border-border bg-background p-4" aria-labelledby="cash-method-summary-title"><h2 id="cash-method-summary-title" className="text-lg font-semibold">Métodos de pago</h2><p className="mb-4 text-sm text-muted-foreground">{paymentsCount} pagos registrados · {formatLempirasUI(pendingAmount)} pendiente</p><Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={methods.map(({ key, label, icon }) => ({ key, label: <span>{icon} {label}</span>, children: <strong className="tabular-nums">{formatLempirasUI(paymentsByMethod[key])}</strong> }))} /><p className="mt-3 text-xs text-muted-foreground">El sistema no recibe conteos separados por método. El cierre compara únicamente el efectivo físico con el efectivo esperado.</p></section>;
}
