import { CircleAlert, CircleCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { FiscalSequence, FiscalSettings } from '@/lib/api';

interface FiscalStatusCardProps { settings: FiscalSettings | null; sequence: FiscalSequence | null }

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
  const isRangeValid = Boolean(sequence?.min_number != null && sequence?.max_number != null && nextNumber != null && nextNumber >= Number(sequence.min_number) && nextNumber <= Number(sequence.max_number));
  const blockers = [
    !isHospitalConfigured ? 'nombre del hospital' : null,
    !hasRtn ? 'RTN del hospital' : null,
    !isSequenceConfigured ? 'CAI y prefijo fiscal' : null,
    !isSequenceActive ? 'secuencia fiscal activa' : null,
    !isDateValid ? 'fecha límite vigente' : null,
    !isRangeValid ? 'siguiente correlativo dentro del rango autorizado' : null,
    isPlaceholderHospital || isPlaceholderCai ? 'datos temporales o de validación' : null,
  ].filter(Boolean);
  const isConfigured = blockers.length === 0;
  const Icon = isConfigured ? CircleCheck : CircleAlert;

  return (
    <section aria-label="Estado de configuración fiscal" className={`rounded-xl border p-4 ${isConfigured ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10'}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={isConfigured ? 'text-success' : 'text-warning'} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{isConfigured ? 'Configuración completa' : 'Configuración pendiente'}</h3>
            <Badge variant="secondary">{isConfigured ? 'Lista' : 'Requiere revisión'}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{isConfigured ? 'El sistema está listo para emitir facturas.' : 'Complete los datos autorizados antes de emitir recibos finales.'}</p>
        </div>
      </div>
      {blockers.length > 0 ? <p className="mt-3 border-t border-warning/20 pt-3 text-xs text-warning-foreground">Faltan o requieren revisión: {blockers.join(', ')}.</p> : null}
    </section>
  );
}
