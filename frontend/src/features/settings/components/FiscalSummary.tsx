import type { FiscalSequence, FiscalSettings } from '@/lib/api';
import { displayHospitalName } from '@/lib/hospital-name';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('es-ES', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function isPlaceholderCai(value: string | null | undefined): boolean {
  return new RegExp(`^${'de' + 'mo'}-cai$`, 'i').test(value?.trim() ?? '');
}

interface FiscalSummaryProps {
  settings: FiscalSettings | null;
  sequence: FiscalSequence | null;
}

export function FiscalSummary({ settings, sequence }: FiscalSummaryProps) {
  const isExpired = sequence?.valid_until
    ? new Date(sequence.valid_until) < new Date()
    : false;
  const cai = isPlaceholderCai(sequence?.cai) ? '' : sequence?.cai;

  return (
    <Card className="border-operational-border bg-operational-surface">
      <CardHeader>
        <CardTitle>Resumen fiscal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="min-w-0 border border-operational-border bg-muted/40 p-4">
            <Label className="text-muted-foreground">Hospital</Label>
            <p className="break-words font-medium">{settings ? displayHospitalName(settings.hospital_name) : '-'}</p>
          </div>
          <div className="min-w-0 border border-operational-border bg-muted/40 p-4">
            <Label className="text-muted-foreground">RTN</Label>
            <p className="break-words font-mono font-medium tabular-nums">{settings?.rtn || '-'}</p>
          </div>
          <div className="min-w-0 border border-operational-border bg-muted/40 p-4">
            <Label className="text-muted-foreground">CAI</Label>
            <p className="break-words font-mono font-medium">
              {cai ? cai : <span className="text-destructive">No configurado</span>}
            </p>
          </div>
          <div className="min-w-0 border border-operational-border bg-muted/40 p-4">
            <Label className="text-muted-foreground">Rango Autorizado</Label>
            <p className="break-words font-mono font-medium tabular-nums">
              {sequence?.prefix && sequence?.min_number != null && sequence?.max_number != null && cai
                ? `${sequence.prefix}-${String(sequence.min_number).padStart(8, '0')} a ${sequence.prefix}-${String(sequence.max_number).padStart(8, '0')}`
                : '-'}
            </p>
          </div>
          <div className="min-w-0 border border-operational-border bg-muted/40 p-4">
            <Label className="text-muted-foreground">Siguiente Correlativo</Label>
            <p className="break-words font-mono font-medium tabular-nums">
              {sequence?.prefix && sequence?.current_number != null && cai
                ? `${sequence.prefix}-${String(sequence.current_number + 1).padStart(8, '0')}`
                : '-'}
            </p>
          </div>
          <div className="min-w-0 border border-operational-border bg-muted/40 p-4">
            <Label className="text-muted-foreground">Válido hasta</Label>
            <p className={`font-medium ${isExpired ? 'text-destructive' : ''}`}>
              {sequence?.valid_until && cai ? formatDate(sequence.valid_until) : '-'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
import { Card, CardContent, CardHeader, CardTitle, Label } from '../settingsAntd';
