import type { Invoice } from '../../../lib/api';
import { formatLocalizedDateTime } from '../../../lib/format/formatDate';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';

export function invoicePatientNameLabel(invoice: Invoice | null): string {
  const patientName = invoice?.patient_name?.trim();
  return patientName ? patientName : 'Paciente sin nombre';
}

export function formatDate(value: string): string {
  const formatted = formatLocalizedDateTime(value);

  return formatted === '-' ? 'Fecha no disponible' : formatted;
}

export function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasUIFromCents(parseCents(value)) ?? 'No disponible';
}
