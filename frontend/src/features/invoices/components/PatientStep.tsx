import { CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Form, Input, Typography } from 'antd';
import { forwardRef, useEffect, useRef } from 'react';
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
  useEffect(() => { if (error) errorSummaryRef.current?.focus(); }, [error]);

  return (
    <section aria-labelledby="patient-step-title" className="grid min-w-0 gap-4 lg:grid-cols-[minmax(13rem,0.7fr)_minmax(0,1.3fr)] lg:items-start">
      <header className="border-b border-border pb-3 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
        <div className="flex items-start gap-3">
          <UserOutlined aria-hidden="true" className="mt-1" />
          <div>
            <Typography.Text type="secondary">Paciente</Typography.Text>
            <Typography.Title id="patient-step-title" level={2}>Identificar paciente</Typography.Title>
            <Typography.Paragraph className="mb-0">Solo el nombre es obligatorio para emitir la factura.</Typography.Paragraph>
          </div>
        </div>
      </header>

      <div className="min-w-0">
        {error ? <div ref={errorSummaryRef} tabIndex={-1} role="alert" id="patient-name-error" className="mb-3"><Alert role="presentation" type="error" showIcon title="Revise el nombre del paciente" description={error} /></div> : null}

        <Form layout="vertical" onFinish={onPatientSubmit}>
          <label className="font-medium" htmlFor="patient-name">Nombre del paciente *</label>
          <Form.Item required validateStatus={error ? 'error' : undefined} className="mb-2">
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

        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer text-foreground">Datos opcionales</summary>
          <p className="mt-2">La factura no necesita expediente clínico, identidad ni otros datos del paciente. El nombre es suficiente.</p>
        </details>

        {patientName.trim() ? <Alert className="mt-3" role="status" type="success" showIcon icon={<CheckCircleOutlined />} title="Paciente identificado" /> : null}
      </div>
    </section>
  );
});
