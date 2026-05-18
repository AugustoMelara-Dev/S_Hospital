import { CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { FiscalSettings, FiscalSequence } from '@/lib/api';

interface FiscalStatusCardProps {
  settings: FiscalSettings | null;
  sequence: FiscalSequence | null;
}

export function FiscalStatusCard({ settings, sequence }: FiscalStatusCardProps) {
  const isHospitalConfigured = Boolean(settings?.hospital_name?.trim());
  const isSequenceConfigured = Boolean(
    sequence?.cai?.trim() &&
    sequence?.prefix?.trim() &&
    sequence?.min_number != null &&
    sequence?.max_number != null
  );

  const isConfigured = isHospitalConfigured && isSequenceConfigured;

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
              {isConfigured ? 'Configuración Completa' : 'Configuración Incompleta'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isConfigured
                ? 'El sistema está listo para emitir facturas.'
                : 'Complete la configuración fiscal para poder emitir facturas.'}
            </p>
          </div>
        </div>
        {!isHospitalConfigured && (
          <p className="mt-3 text-sm text-amber-700">
            Faltan: nombre del hospital
          </p>
        )}
        {!isSequenceConfigured && (
          <p className="mt-1 text-sm text-amber-700">
            Faltan: CAI, prefijo o rango de la secuencia fiscal
          </p>
        )}
      </CardContent>
    </Card>
  );
}