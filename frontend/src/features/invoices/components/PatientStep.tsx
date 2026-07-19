import { CheckCircleIcon, UserIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { invoiceSchema, PATIENT_NAME_MAX_LENGTH, type InvoiceFormData } from '../../../schemas/invoice.schema';

type PatientStepProps = {
  patientName: string;
  onPatientNameChange: (value: string) => void;
  onPatientSubmit?: () => void;
  error?: string;
};

export const PatientStep = forwardRef<HTMLInputElement, PatientStepProps>(function PatientStep(
  { patientName, onPatientNameChange, onPatientSubmit, error }, ref,
) {
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const externalPatientNameRef = useRef(patientName);
  const [optionalDataOpen, setOptionalDataOpen] = useState(false);
  const form = useForm<Pick<InvoiceFormData, 'patient_name'>>({
    resolver: zodResolver(invoiceSchema.pick({ patient_name: true })),
    defaultValues: { patient_name: patientName },
  });
  const visibleError = error ?? form.formState.errors.patient_name?.message;
  useEffect(() => {
    if (!error) return;
    form.setError('patient_name', { type: 'server', message: error });
    errorSummaryRef.current?.focus();
  }, [error, form]);
  useEffect(() => {
    if (patientName === externalPatientNameRef.current) return;
    externalPatientNameRef.current = patientName;
    form.setValue('patient_name', patientName, { shouldValidate: false });
  }, [form, patientName]);

  return (
    <div className="min-w-0">
      <header className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
        <UserIcon aria-hidden="true" className="text-secondary" />
        <h2 id="patient-step-title" className="text-base font-semibold text-foreground">Paciente</h2>
        <span className="text-sm text-muted-foreground">Solo el nombre es obligatorio.</span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3 text-sm">
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-9 px-0"
            aria-expanded={optionalDataOpen}
            aria-controls="patient-optional-data"
            onClick={() => setOptionalDataOpen((open) => !open)}
          >
            Datos opcionales
          </Button>
          {patientName.trim() ? (
            <span role="status" className="inline-flex items-center gap-1.5 font-medium text-success">
              <CheckCircleIcon aria-hidden="true" />
              Paciente identificado
            </span>
          ) : null}
        </div>
      </header>

      <div className="min-w-0">
        {visibleError ? <div ref={errorSummaryRef} tabIndex={-1} role="alert" id="patient-name-error" className="mb-3"><Alert role="presentation" variant="destructive"><AlertTitle>Revise el nombre del paciente</AlertTitle><AlertDescription>{visibleError}</AlertDescription></Alert></div> : null}

        <form onSubmit={form.handleSubmit(() => onPatientSubmit?.())} noValidate>
          <label className="font-medium" htmlFor="patient-name">Nombre del paciente *</label>
          <Controller
            control={form.control}
            name="patient_name"
            render={({ field }) => <div className="relative"><UserIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input
              {...field}
              ref={(input) => {
                field.ref(input);
                if (typeof ref === 'function') ref(input);
                else if (ref) ref.current = input;
              }}
              id="patient-name"
              maxLength={PATIENT_NAME_MAX_LENGTH}
              onChange={(event) => {
                field.onChange(event);
                externalPatientNameRef.current = event.target.value;
                form.clearErrors('patient_name');
                onPatientNameChange(event.target.value);
              }}
              aria-invalid={Boolean(visibleError)}
              aria-describedby={visibleError ? 'patient-name-help patient-name-error' : 'patient-name-help'}
              autoComplete="name"
              placeholder="Ej. Maria Lopez…"
              className="pl-9"
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                onPatientSubmit?.();
              }}
            /></div>}
          />
            <span id="patient-name-help" className="text-xs text-muted-foreground">{patientName.length}/{PATIENT_NAME_MAX_LENGTH} caracteres</span>
        </form>

        {optionalDataOpen ? (
          <p id="patient-optional-data" className="mt-2 border-t border-border pt-2 text-sm text-muted-foreground">
            La factura no necesita expediente clínico, identidad ni otros datos del paciente. El nombre es suficiente.
          </p>
        ) : null}
      </div>
    </div>
  );
});
