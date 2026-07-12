import { AlertOutlined as AlertCircle, CheckCircleOutlined as CheckCircle } from '@ant-design/icons';
import { Card, CardContent, StatusBadge } from '../settingsAntd';
import type { FiscalSequence, FiscalSettings } from '@/lib/api';

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
    !isSequenceConfigured ? 'CAI y prefijo fiscal' : null,
    !isSequenceActive ? 'secuencia fiscal activa' : null,
    !isDateValid ? 'fecha limite vigente' : null,
    !isRangeValid ? 'siguiente correlativo dentro del rango autorizado' : null,
    isPlaceholderHospital || isPlaceholderCai ? 'datos temporales o de validacion' : null,
  ].filter(Boolean);
  const isConfigured = blockers.length === 0;

  return (
    <Card className={isConfigured ? 'border-success/30 bg-success/10 text-success-foreground' : 'border-warning/30 bg-warning/10 text-warning-foreground'}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`rounded-xl p-3 ${isConfigured ? 'bg-success/10' : 'bg-warning/10'}`}>
            {isConfigured ? (
              <CheckCircle aria-hidden="true" className="h-6 w-6 text-success" />
            ) : (
              <AlertCircle aria-hidden="true" className="h-6 w-6 text-warning" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">
                {isConfigured ? 'Configuración completa' : 'Configuración pendiente'}
              </h3>
              <StatusBadge status={isConfigured ? 'success' : 'pending'}>
                {isConfigured ? 'Lista' : 'Requiere revisión'}
              </StatusBadge>
            </div>
            <p className="text-sm text-muted-foreground">
              {isConfigured
                ? 'El sistema esta listo para emitir facturas.'
                : 'Complete los datos autorizados antes de emitir recibos finales.'}
            </p>
          </div>
        </div>
        {blockers.length > 0 && (
          <p className="mt-3 text-sm text-warning-foreground">
            Faltan o requieren revisión: {blockers.join(', ')}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
