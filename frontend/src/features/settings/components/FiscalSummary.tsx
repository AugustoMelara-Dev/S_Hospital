import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { FiscalSettings, FiscalSequence } from '@/lib/api';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('es-ES', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

interface FiscalSummaryProps {
  settings: FiscalSettings | null;
  sequence: FiscalSequence | null;
}

export function FiscalSummary({ settings, sequence }: FiscalSummaryProps) {
  const isExpired = sequence?.valid_until
    ? new Date(sequence.valid_until) < new Date()
    : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen Fiscal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">Hospital</Label>
            <p className="font-medium">{settings?.hospital_name || '-'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">RTN</Label>
            <p className="font-medium">{settings?.rtn || '-'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">CAI</Label>
            <p className="font-medium">
              {sequence?.cai ? (
                sequence.cai
              ) : (
                <span className="text-destructive">No configurado</span>
              )}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Rango Autorizado</Label>
            <p className="font-medium">
              {sequence?.prefix && sequence?.min_number != null && sequence?.max_number != null ? (
                `${sequence.prefix}-${String(sequence.min_number).padStart(7, '0')} a ${sequence.prefix}-${String(sequence.max_number).padStart(7, '0')}`
              ) : (
                '-'
              )}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Siguiente Correlativo</Label>
            <p className="font-medium">
              {sequence?.prefix && sequence?.current_number != null ? (
                `${sequence.prefix}-${String(sequence.current_number + 1).padStart(7, '0')}`
              ) : (
                '-'
              )}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Válido Hasta</Label>
            <p className={`font-medium ${isExpired ? 'text-destructive' : ''}`}>
              {sequence?.valid_until ? formatDate(sequence.valid_until) : '-'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}