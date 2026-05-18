import { User } from 'lucide-react';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';

type PatientStepProps = {
  patientName: string;
  onPatientNameChange: (value: string) => void;
  error?: string;
};

export function PatientStep({ patientName, onPatientNameChange, error }: PatientStepProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="patient-name" className="mb-1.5 block">
          Nombre del Paciente *
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="patient-name"
            value={patientName}
            onChange={(e) => onPatientNameChange(e.target.value)}
            placeholder="Ingrese nombre del paciente"
            autoFocus
            className={`pl-10 ${error ? 'border-destructive ring-destructive' : ''}`}
            aria-invalid={error ? 'true' : 'false'}
          />
        </div>
        {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
      </div>
      {patientName && (
        <p className="text-sm text-muted-foreground">
          Paciente: <span className="font-medium text-foreground">{patientName}</span>
        </p>
      )}
    </div>
  );
}
