import type { UseFormReturn } from 'react-hook-form';
import { AdminField } from '@/design-system/admin/components';
import { PATIENT_NAME_MAX_LENGTH, type CobrarPatientFormData } from '../cobrarSchema';
import { FOCUS_RING } from './cobrarUi';

type PatientZoneProps = {
  form: UseFormReturn<CobrarPatientFormData>;
  disabled?: boolean;
};

/**
 * Entrada de la estación: el nombre del paciente, único dato personal.
 *
 * Es la primera línea de la cuenta (no un formulario aparte): un icono de
 * identidad abre la lectura y el campo es el control más alto de la estación
 * porque es el único obligatorio. Sin contadores, fichas ni confirmaciones
 * decorativas.
 */
export function PatientZone({ form, disabled }: PatientZoneProps) {
  const error = form.formState.errors.patient_name?.message;

  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end">
      <div className="pb-1">
        <h3 className="text-[length:var(--ui-text-md)] font-semibold text-[color:var(--ui-ink)]">Paciente</h3>
        <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Único dato personal requerido.</p>
      </div>
      <AdminField
        htmlFor="cobrar-patient-name"
        label="Nombre del paciente"
        required
        error={error}
        className="min-w-0"
      >
        <input
          {...form.register('patient_name')}
          id="cobrar-patient-name"
          autoFocus
          disabled={disabled}
          autoComplete="off"
          maxLength={PATIENT_NAME_MAX_LENGTH}
          placeholder="Ej. José Ángel O'Brien…"
          aria-invalid={error ? true : undefined}
          className={`h-[var(--ui-control-h-operational)] w-full rounded-[var(--ui-radius-control)] border bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-md)] text-[color:var(--ui-ink)] placeholder:text-[color:var(--ui-ink-faint)] ${
            error ? 'border-[var(--ui-danger)]' : 'border-[var(--ui-control-border)]'
          } ${FOCUS_RING}`}
        />
      </AdminField>
    </div>
  );
}
