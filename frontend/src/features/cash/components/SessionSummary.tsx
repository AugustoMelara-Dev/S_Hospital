import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { CashSession } from '@/lib/api';

interface SessionSummaryProps {
  session: CashSession;
  closingAmount: string;
  difference: number;
  onClosingAmountChange: (value: string) => void;
}

export function SessionSummary({
  session,
  closingAmount,
  difference,
  onClosingAmountChange,
}: SessionSummaryProps) {
  const expectedAmount = parseFloat(session.expected_cash_amount ?? session.expected_amount ?? '0');
  const openingAmount = parseFloat(session.opening_amount ?? '0');

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <Label className="text-muted-foreground">Monto Apertura</Label>
          <p className="text-2xl font-bold">L. {openingAmount.toFixed(2)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Label className="text-muted-foreground">Total Esperado</Label>
          <p className="text-2xl font-bold">L. {expectedAmount.toFixed(2)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Label className="text-muted-foreground">Contado</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={closingAmount}
            onChange={(e) => onClosingAmountChange(e.target.value)}
            placeholder="0.00"
            className="text-lg"
          />
        </CardContent>
      </Card>

      <Card className={cn(difference !== 0 ? 'border-amber-200 bg-amber-50' : '')}>
        <CardContent className="pt-6">
          <Label className="text-muted-foreground">Diferencia</Label>
          <p
            className={cn(
              'text-2xl font-bold',
              difference > 0 ? 'text-emerald-600' : difference < 0 ? 'text-red-600' : '',
            )}
          >
            {difference === 0
              ? 'L. 0.00'
              : `L. ${difference > 0 ? '+' : ''}${difference.toFixed(2)}`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
