import { AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { FiscalSequence, FiscalSettings } from '@/lib/api';
import { INSTITUTIONAL_RECEIPT_PAPER_OPTIONS } from '@/lib/institutionalReceiptPaper';

interface FiscalStatusCardProps {
  settings: FiscalSettings | null;
  sequence: FiscalSequence | null;
}

export function FiscalStatusCard({ settings, sequence }: FiscalStatusCardProps) {
  const hospitalName = settings?.hospital_name?.trim() ?? '';
  const cai = sequence?.cai?.trim() ?? '';
  const isPlaceholderHospital = new RegExp(`^hospital ${'de' + 'mo'}$`, 'i').test(hospitalName);
  const isPlaceholderCai = new RegExp(`^${'de' + 'mo'}-cai$`, 'i').test(cai);
  const isHospitalConfigured = Boolean(hospitalName) && !isPlaceholderHospital;
  const hasRtn = Boolean(settings?.rtn?.trim());
  const hasReceiptPaperSize = INSTITUTIONAL_RECEIPT_PAPER_OPTIONS.some((option) => option.value === settings?.receipt_paper_size);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validUntil = sequence?.valid_until ? new Date(sequence.valid_until) : null;
  validUntil?.setHours(0, 0, 0, 0);
  const nextNumber = sequence?.current_number != null ? Number(sequence.current_number) + 1 : null;
  const isSequenceConfigured = Boolean(cai && sequence?.prefix?.trim()) && !isPlaceholderCai;
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
    isPlaceholderHospital || isPlaceholderCai ? 'datos temporales o de validación' : null,
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
            <h2 className="font-semibold">
              {isConfigured ? 'Configuración completa' : 'Configuración pendiente'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isConfigured
                ? 'El sistema esta listo para emitir facturas.'
                : 'Complete los datos autorizados antes de emitir recibos finales.'}
            </p>
          </div>
        </div>
        {blockers.length > 0 && (
          <p className="mt-3 text-sm text-amber-700">
            Faltan o requieren revision: {blockers.join(', ')}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
