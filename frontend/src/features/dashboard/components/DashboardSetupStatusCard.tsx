import { AlertTriangle, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { type SetupStatus, type SetupStatusStep } from './dashboardTypes';

export type DashboardSetupStatusCardProps = {
  canViewFiscalSettings: boolean;
  onReview: () => void;
  setupStatus: SetupStatus;
};

const SETUP_STEPS: Array<{ key: keyof SetupStatus['steps']; label: string; helper: string }> = [
  { key: 'fiscal_settings', label: 'Datos del hospital', helper: 'Nombre y RTN' },
  { key: 'admin_exists', label: 'Usuario administrador', helper: 'Acceso principal listo' },
  { key: 'catalog_has_services', label: 'Catalogo', helper: 'Servicios para facturar' },
  { key: 'fiscal_sequence_exists', label: 'Rango fiscal', helper: 'Numeracion vigente' },
];

export function DashboardSetupStatusCard({
  canViewFiscalSettings,
  onReview,
  setupStatus,
}: DashboardSetupStatusCardProps) {
  return (
    <Card data-slot="dashboard-setup-status" className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <CardTitle className="text-base font-bold text-warning-foreground">
                Configuracion pendiente
              </CardTitle>
              <CardDescription className="mt-1 text-xs text-warning-foreground/80">
                Complete estos datos para emitir facturas correctamente.
              </CardDescription>
            </div>
          </div>
          {canViewFiscalSettings ? (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={onReview}
              aria-label="Revisar configuracion pendiente"
            >
              <Sparkles aria-hidden="true" className="size-3.5" />
              Revisar
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SETUP_STEPS.map((step) => (
            <SetupStepCheck
              key={step.key}
              label={step.label}
              helper={step.helper}
              done={setupStatus.steps[step.key]}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type SetupStepCheckProps = SetupStatusStep;

function SetupStepCheck({ done, helper, label }: SetupStepCheckProps) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
      <div className="mt-0.5 shrink-0">
        {done ? (
          <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
        ) : (
          <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{helper}</p>
      </div>
    </div>
  );
}
