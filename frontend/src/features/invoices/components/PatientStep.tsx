import { forwardRef, useEffect, useRef } from 'react';
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
  const errorSummaryRef = useRef<HTMLParagraphElement | null>(null);
  const errorId = error ? 'patient-name-error' : undefined;
  const helpId = 'patient-name-help';
  const remainingCharacters = PATIENT_NAME_MAX_LENGTH - patientName.length;
  const isNearLimit = remainingCharacters <= 20;

  useEffect(() => {
    if (error) {
      errorSummaryRef.current?.focus();
    }
  }, [error]);

  return (
    <div className="min-w-0">
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

      <div className="flex min-w-0 flex-col gap-3">
        <div className="w-full min-w-0">
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
        <div className="w-full rounded-md border border-border bg-card px-3 py-2">
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
        {error && (
          <p
            ref={errorSummaryRef}
            id={errorId}
            className="mt-2 rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
            role="alert"
            tabIndex={-1}
          >
            {error}
          </p>
        )}
      </div>
      {patientName && (
        <p className="mt-3 rounded-md border border-secondary/25 bg-secondary/10 px-3 py-2 text-sm text-muted-foreground">
          Paciente: <span className="break-words font-medium text-foreground">{patientName}</span>
        </p>
      )}
      <details className="mt-4 border-t border-operational-border pt-3 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Datos opcionales
        </summary>
        <p className="pb-2 text-sm leading-relaxed text-muted-foreground">
          La factura no necesita expediente clínico, identidad ni otros datos del paciente. El nombre es suficiente.
        </p>
      </details>
    </div>
  );
});
