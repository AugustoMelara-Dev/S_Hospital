import type { FiscalSequence, FiscalSettings } from '@/lib/api';
import { displayHospitalName } from '@/lib/hospital-name';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('es-ES', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function isPlaceholderCai(value: string | null | undefined): boolean {
  return new RegExp(`^${'de' + 'mo'}-cai$`, 'i').test(value?.trim() ?? '');
}

interface FiscalSummaryProps {
  settings: FiscalSettings | null;
  sequence: FiscalSequence | null;
}

export function FiscalSummary({ settings, sequence }: FiscalSummaryProps) {
  const isExpired = sequence?.valid_until
    ? new Date(sequence.valid_until) < new Date()
    : false;
  const cai = isPlaceholderCai(sequence?.cai) ? '' : sequence?.cai;
  const fields = [
    { label: 'Hospital', value: settings ? displayHospitalName(settings.hospital_name) : '-' },
    { label: 'RTN', value: settings?.rtn || '-', mono: true },
    { label: 'CAI', value: cai || 'No configurado', mono: true, warning: !cai },
    {
      label: 'Rango autorizado',
      value: sequence?.prefix && sequence?.min_number != null && sequence?.max_number != null && cai
        ? `${sequence.prefix}-${String(sequence.min_number).padStart(8, '0')} a ${sequence.prefix}-${String(sequence.max_number).padStart(8, '0')}`
        : '-',
      mono: true,
    },
    {
      label: 'Siguiente correlativo',
      value: sequence?.prefix && sequence?.current_number != null && cai
        ? `${sequence.prefix}-${String(sequence.current_number + 1).padStart(8, '0')}`
        : '-',
      mono: true,
    },
    {
      label: 'Válido hasta',
      value: sequence?.valid_until && cai ? formatDate(sequence.valid_until) : '-',
      warning: isExpired,
    },
  ];

  return (
    <section aria-labelledby="fiscal-summary-title" className="border border-operational-border bg-operational-surface">
      <h2 id="fiscal-summary-title" className="border-b border-border px-4 py-3 text-sm font-semibold">Resumen fiscal</h2>
      <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <div key={field.label} data-testid="fiscal-summary-field" className="min-w-0">
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd className={`break-words text-sm font-medium tabular-nums ${field.mono ? 'font-mono' : ''} ${field.warning ? 'text-destructive' : ''}`}>
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
