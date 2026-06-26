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
      <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
        Ningun cajero ha recibido pagos hoy
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border/60">
      {cashiers.map((cashier) => (
        <div key={cashier.user_id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-hospital-primary/10 text-hospital-primary">
              <User className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{cashier.name}</p>
              <p className="text-xs text-muted-foreground">@{cashier.username}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-foreground">{formatLempirasUI(cashier.total_collected)}</p>
            <Badge variant="secondary" className="mt-1 h-5 px-2 py-0 text-[10px]">
              {cashier.payment_count} {cashier.payment_count === 1 ? 'pago' : 'pagos'}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
