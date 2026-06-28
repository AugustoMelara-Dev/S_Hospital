import { forwardRef } from 'react';
import { CheckCircle2, User } from 'lucide-react';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { PATIENT_NAME_MAX_LENGTH } from '../../../schemas/invoice.schema';

type PatientStepProps = {
  patientName: string;
  onPatientNameChange: (value: string) => void;
  onPatientSubmit?: () => void;
  error?: string;
};

export const PatientStep = forwardRef<HTMLInputElement, PatientStepProps>(function PatientStep(
  { patientName, onPatientNameChange, onPatientSubmit, error },
  ref,
) {
  const errorId = error ? 'patient-name-error' : undefined;
  const helpId = 'patient-name-help';
  const remainingCharacters = PATIENT_NAME_MAX_LENGTH - patientName.length;
  const isNearLimit = remainingCharacters <= 20;

  return (
    <div className="rounded-panel border border-operational-border bg-operational-panel/65 p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-secondary/25 bg-secondary/10 text-secondary">
            <User className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Paciente</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Registre el nombre que debe aparecer en la factura.
            </p>
          </div>
        </div>
        {patientName ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success-foreground">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Capturado
          </span>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] md:items-end">
        <div className="min-w-0">
        <Label htmlFor="patient-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Nombre del paciente *
        </Label>
        <div className="relative">
          <Input
            ref={ref}
            id="patient-name"
            name="patient_name"
            value={patientName}
            onChange={(e) => onPatientNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onPatientSubmit?.();
              }
            }}
            placeholder="Ej. Maria Lopez…"
            autoComplete="off"
            className={`min-h-14 text-lg font-semibold ${error ? 'border-destructive ring-destructive' : ''}`}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={errorId ? `${helpId} ${errorId}` : helpId}
            maxLength={PATIENT_NAME_MAX_LENGTH}
          />
        </div>
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Dato requerido</p>
          <p
            id={helpId}
            className={`mt-1 text-xs ${isNearLimit ? 'font-medium text-warning' : 'text-muted-foreground'}`}
          >
            {patientName.length}/{PATIENT_NAME_MAX_LENGTH} caracteres
          </p>
        </div>
      </div>
      <div className="min-w-0">
        {error && <p id={errorId} className="mt-1.5 text-sm text-destructive" role="alert">{error}</p>}
      </div>
      {patientName && (
        <p className="mt-3 rounded-md border border-secondary/25 bg-secondary/10 px-3 py-2 text-sm text-muted-foreground">
          Paciente: <span className="break-words font-medium text-foreground">{patientName}</span>
        </p>
      )}
    </div>
  );
});
