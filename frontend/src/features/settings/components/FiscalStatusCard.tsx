import { CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { FiscalSettings, FiscalSequence } from '@/lib/api';

interface FiscalStatusCardProps {
  settings: FiscalSettings | null;
  sequence: FiscalSequence | null;
}

export function FiscalStatusCard({ settings, sequence }: FiscalStatusCardProps) {
  const isHospitalConfigured = Boolean(settings?.hospital_name?.trim());
  const hasRtn = Boolean(settings?.rtn?.trim());
  const hasReceiptPaperSize = ['half_letter', 'letter', 'a5'].includes(settings?.receipt_paper_size ?? '');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validUntil = sequence?.valid_until ? new Date(sequence.valid_until) : null;
  validUntil?.setHours(0, 0, 0, 0);
  const nextNumber = sequence?.current_number != null ? Number(sequence.current_number) + 1 : null;
  const isSequenceConfigured = Boolean(sequence?.cai?.trim() && sequence?.prefix?.trim());
  const isSequenceActive = sequence?.active === true;
  const isDateValid = Boolean(validUntil && validUntil >= today);
  const isRangeValid = Boolean(
    sequence?.min_number != null &&
      sequence?.max_number != null &&
      nextNumber != null &&
      nextNumber >= Number(sequence.min_number) &&
      nextNumber <= Number(sequence.max_number),
  );

  const blockers = [
    !isHospitalConfigured ? 'nombre del hospital' : null,
    !hasRtn ? 'RTN del hospital' : null,
    !hasReceiptPaperSize ? 'tamano de recibo institucional' : null,
    !isSequenceConfigured ? 'CAI y prefijo fiscal' : null,
    !isSequenceActive ? 'secuencia fiscal activa' : null,
    !isDateValid ? 'fecha limite vigente' : null,
    !isRangeValid ? 'siguiente correlativo dentro del rango autorizado' : null,
  ].filter(Boolean);
  const isConfigured = blockers.length === 0;

  return (
    <Card className={isConfigured ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${isConfigured ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            {isConfigured ? (
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold">
              {isConfigured ? 'Configuración completa' : 'Configuración incompleta'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isConfigured
                ? 'El sistema está listo para emitir facturas.'
                : 'Complete los datos fiscales antes de emitir facturas.'}
            </p>
          </div>
        </div>
        {blockers.length > 0 && (
          <p className="mt-3 text-sm text-amber-700">
            Faltan o requieren revisión: {blockers.join(', ')}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
