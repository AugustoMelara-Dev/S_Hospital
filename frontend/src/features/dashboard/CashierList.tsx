import { User } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { formatLempirasUI } from '../../lib/money';

type CashierSummary = {
  user_id: number;
  name: string;
  username: string;
  payment_count: number;
  total_collected: string;
};

type CashierListProps = {
  cashiers: CashierSummary[];
};

export function CashierList({ cashiers }: CashierListProps) {
  if (cashiers.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Ningún cajero ha recibido pagos hoy
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border/60">
      {cashiers.map((cashier) => (
        <div key={cashier.user_id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
              <User className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{cashier.name}</p>
              <p className="text-xs text-muted-foreground">@{cashier.username}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-foreground">
              {formatLempirasUI(cashier.total_collected)}
            </p>
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 mt-0.5">
              {cashier.payment_count} {cashier.payment_count === 1 ? 'pago' : 'pagos'}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
