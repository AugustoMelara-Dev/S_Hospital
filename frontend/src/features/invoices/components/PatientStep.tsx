import { forwardRef } from 'react';
import { User } from 'lucide-react';
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
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-secondary/25 bg-secondary/10 text-secondary">
          <User className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Paciente</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Registre el nombre que debe aparecer en la factura.
          </p>
        </div>
      </div>

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
        <p
          id={helpId}
          className={`mt-1.5 text-xs ${isNearLimit ? 'font-medium text-warning' : 'text-muted-foreground'}`}
        >
          {patientName.length}/{PATIENT_NAME_MAX_LENGTH} caracteres
        </p>
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
