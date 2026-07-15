import { CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input } from 'antd';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { PATIENT_NAME_MAX_LENGTH } from '../../../schemas/invoice.schema';

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
  const [optionalDataOpen, setOptionalDataOpen] = useState(false);
  useEffect(() => { if (error) errorSummaryRef.current?.focus(); }, [error]);

  return (
    <div className="min-w-0">
      <header className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
        <UserOutlined aria-hidden="true" className="text-secondary" />
        <h2 id="patient-step-title" className="text-base font-semibold text-foreground">Paciente</h2>
        <span className="text-sm text-muted-foreground">Solo el nombre es obligatorio.</span>
      </header>

      <div className="min-w-0">
        {error ? <div ref={errorSummaryRef} tabIndex={-1} role="alert" id="patient-name-error" className="mb-3"><Alert role="presentation" type="error" showIcon title="Revise el nombre del paciente" description={error} /></div> : null}

        <Form layout="vertical" onFinish={onPatientSubmit}>
          <label className="font-medium" htmlFor="patient-name">Nombre del paciente *</label>
          <Form.Item required validateStatus={error ? 'error' : undefined} className="mb-1">
            <Input
              ref={(control) => {
                const input = control?.input ?? null;
                if (typeof ref === 'function') ref(input);
                else if (ref) ref.current = input;
              }}
              id="patient-name"
              name="patient_name"
              value={patientName}
              maxLength={PATIENT_NAME_MAX_LENGTH}
              onChange={(event) => onPatientNameChange(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'patient-name-help patient-name-error' : 'patient-name-help'}
              autoComplete="name"
              placeholder="Ej. Maria Lopez…"
              prefix={<UserOutlined aria-hidden="true" />}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onPatientSubmit?.(); } }}
            />
            <span id="patient-name-help" className="text-xs text-muted-foreground">{patientName.length}/{PATIENT_NAME_MAX_LENGTH} caracteres</span>
          </Form.Item>
        </Form>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
          <Button
            type="link"
            className="h-auto min-h-11 px-0"
            aria-expanded={optionalDataOpen}
            aria-controls="patient-optional-data"
            onClick={() => setOptionalDataOpen((open) => !open)}
          >
            Datos opcionales
          </Button>
          {patientName.trim() ? (
            <span role="status" className="inline-flex items-center gap-1.5 font-medium text-success">
              <CheckCircleOutlined aria-hidden="true" />
              Paciente identificado
            </span>
          ) : null}
        </div>
        {optionalDataOpen ? (
          <p id="patient-optional-data" className="border-t border-border pt-2 text-sm text-muted-foreground">
            La factura no necesita expediente clínico, identidad ni otros datos del paciente. El nombre es suficiente.
          </p>
        ) : null}
      </div>
    </div>
  );
});
