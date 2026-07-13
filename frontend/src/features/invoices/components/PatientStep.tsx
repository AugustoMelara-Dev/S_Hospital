import { CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Form, Input, Space, Typography } from 'antd';
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
    <section aria-labelledby="patient-step-title" className="min-w-0">
      <Space direction="vertical" size="middle" className="w-full">
        <header className="border-b border-border pb-4">
          <Space align="start">
            <UserOutlined aria-hidden="true" />
            <span>
              <Typography.Text type="secondary">Paso 1</Typography.Text>
              <Typography.Title id="patient-step-title" level={2}>Identificar paciente</Typography.Title>
              <Typography.Paragraph>Solo el nombre es obligatorio para emitir la factura.</Typography.Paragraph>
            </span>
          </Space>
        </header>

        {error ? <div ref={errorSummaryRef} tabIndex={-1} role="alert" id="patient-name-error"><Alert role="presentation" type="error" showIcon title="Revise el nombre del paciente" description={error} /></div> : null}

        <Form layout="vertical" onFinish={onPatientSubmit}>
          <div className="w-full"><Typography.Text strong>Dato requerido</Typography.Text></div>
          <label htmlFor="patient-name">Nombre del paciente *</label>
          <Form.Item required validateStatus={error ? 'error' : undefined}>
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
            <span id="patient-name-help">{patientName.length}/{PATIENT_NAME_MAX_LENGTH} caracteres</span>
          </Form.Item>
        </Form>

        <details>
          <summary>Datos opcionales</summary>
          <p>La factura no necesita expediente clínico, identidad ni otros datos del paciente. El nombre es suficiente.</p>
        </details>

        {patientName.trim() ? <Alert role="status" type="success" showIcon icon={<CheckCircleOutlined />} title="Paciente identificado" /> : null}
      </Space>
    </section>
  );
});
