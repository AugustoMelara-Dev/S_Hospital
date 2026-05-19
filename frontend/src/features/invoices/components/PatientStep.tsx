import { forwardRef } from 'react';
import { User } from 'lucide-react';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';

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

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="patient-name" className="mb-1.5 block">
          Nombre del Paciente *
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={ref}
            id="patient-name"
            value={patientName}
            onChange={(e) => onPatientNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onPatientSubmit?.();
              }
            }}
            placeholder="Ingrese nombre del paciente"
            autoFocus
            className={`pl-10 ${error ? 'border-destructive ring-destructive' : ''}`}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={errorId}
          />
        </div>
        {error && <p id={errorId} className="mt-1.5 text-sm text-destructive" role="alert">{error}</p>}
      </div>
      {patientName && (
        <p className="text-sm text-muted-foreground">
          Paciente: <span className="font-medium text-foreground">{patientName}</span>
        </p>
      )}
    </div>
  );
});
