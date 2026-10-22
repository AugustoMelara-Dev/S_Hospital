import { ShieldCheck } from 'lucide-react';
import { AdminCallout } from '@/design-system/admin/components';
import { BackupSupportStatusPanel } from './BackupSupportStatusPanel';
import { RecoveryReadinessCard } from './RecoveryReadinessCard';
import { type OperationalStatus } from '../backupPresentation';
import type { SystemStatus } from '@/lib/api';

export type BackupHealth = 'sin-verificar' | 'requiere-prueba' | 'verificado' | 'error';

const HEALTH_LABEL: Record<BackupHealth, string> = {
  'sin-verificar': 'Copia sin revisar',
  'requiere-prueba': 'Pendiente de comprobar',
  verificado: 'Copia revisada',
  error: 'Con problemas',
};

/**
 * Fórmula dark §2 para el badge de salud: tono + subtle 13 % + borde 36 %.
 * Los estados "sin dato / sin verificar" nunca se pintan como salud (§5).
 */
const HEALTH_CLASS: Record<BackupHealth, string> = {
  'sin-verificar': 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]',
  'requiere-prueba': 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]',
  verificado: 'border-[var(--ui-success-border)] bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]',
  error: 'border-[var(--ui-danger-border)] bg-[var(--ui-danger-subtle)] text-[color:var(--ui-danger)]',
};

export type BackupKpi = { label: string; value: string | number; helper: string };

type HealthPanelProps = {
  automaticLabel: string;
  health: BackupHealth;
  kpis: BackupKpi[];
  lastIntegrityValue: string;
  restoreStatusValue: string;
  pendingFailureValue: string;
  updatedAtLabel: string;
};

/**
 * Bloque único de salud con estado tipado y última copia con integridad.
 * Un dato ausente nunca se pinta como salud.
 */
export function BackupHealthPanel({ automaticLabel, health, kpis, lastIntegrityValue, pendingFailureValue, restoreStatusValue, updatedAtLabel }: HealthPanelProps) {
  return (
    <section aria-label="Salud del respaldo" role="status" className="rounded-[var(--ui-radius-panel)] border border-[var(--ui-line)] bg-[var(--ui-surface)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck aria-hidden="true" className="size-5 text-[color:var(--ui-ink-soft)]" strokeWidth={1.5} />
        <h2 className="text-[length:var(--ui-text-lg)] font-semibold text-[color:var(--ui-ink)]">Salud del respaldo</h2>
        <span className={`ml-auto rounded-[var(--ui-radius)] border px-2 py-0.5 text-[length:var(--ui-text-xs)] font-semibold ${HEALTH_CLASS[health]}`}>
          Estado: {HEALTH_LABEL[health]}
        </span>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="text-[length:var(--ui-text-xs)] font-medium uppercase tracking-wide text-[color:var(--ui-ink-soft)]">Última copia revisada</dt>
          <dd className="mt-1 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">{lastIntegrityValue}</dd>
          <dd className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{restoreStatusValue}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--ui-text-xs)] font-medium uppercase tracking-wide text-[color:var(--ui-ink-soft)]">Respaldo automático</dt>
          <dd className="mt-1 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">{automaticLabel}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--ui-text-xs)] font-medium uppercase tracking-wide text-[color:var(--ui-ink-soft)]">Pendientes / Fallidos</dt>
          <dd className="mt-1 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)]">{pendingFailureValue}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--ui-text-xs)] font-medium uppercase tracking-wide text-[color:var(--ui-ink-soft)]">Última actualización</dt>
          <dd className="mt-1 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">{updatedAtLabel}</dd>
        </div>
      </dl>

      {/* `<section aria-label>` ya expone la función `region`; declarar
          `role="region"` es redundante (jsx-a11y `no-redundant-roles`) y el
          rol implícito conserva el nombre accesible que usan las pruebas. */}
      <section
        aria-label="Indicadores principales de respaldos"
        className="mt-4 grid gap-x-6 gap-y-3 border-t border-[var(--ui-line)] pt-3 sm:grid-cols-3"
      >
        <dl className="contents">
          {kpis.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-[length:var(--ui-text-xs)] font-medium uppercase tracking-[0.06em] text-[color:var(--ui-ink-faint)]">{item.label}</dt>
              <dd className="mt-1.5 text-[length:var(--ui-text-metric)] font-semibold leading-none tabular-nums text-[color:var(--ui-ink)]">{item.value}</dd>
              <dd className="mt-1.5 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-faint)]">{item.helper}</dd>
            </div>
          ))}
        </dl>
      </section>
    </section>
  );
}

type MaintenanceProps = {
  advancedStatusId: string;
  latestBackupNotConfirmed: boolean;
  onToggleAdvancedStatus: () => void;
  onToggle: (open: boolean) => void;
  operationalStatus: { level: OperationalStatus; label: string; description: string } | null;
  open: boolean;
  readinessBlockers: string[];
  showAdvancedStatus: boolean;
  stalePendingCount: number;
  stalePendingThresholdMinutes: number;
  systemStatus: SystemStatus | null;
};

export function BackupMaintenanceSection({
  advancedStatusId,
  latestBackupNotConfirmed,
  onToggle,
  onToggleAdvancedStatus,
  operationalStatus,
  open,
  readinessBlockers,
  showAdvancedStatus,
  stalePendingCount,
  stalePendingThresholdMinutes,
  systemStatus,
}: MaintenanceProps) {
  return (
    <details
      className="rounded-[var(--ui-radius-panel)] border border-[var(--ui-line)] bg-[var(--ui-surface)]"
      open={open}
      onToggle={(event) => onToggle((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]">
        Mantenimiento y preparación
      </summary>
      <div className="flex flex-col gap-3 border-t border-[var(--ui-line)] p-4">
        {systemStatus && operationalStatus ? (
          <BackupSupportStatusPanel
            advancedStatusId={advancedStatusId}
            latestBackupNotConfirmed={latestBackupNotConfirmed}
            onToggleAdvancedStatus={onToggleAdvancedStatus}
            operationalStatus={operationalStatus}
            showAdvancedStatus={showAdvancedStatus}
            stalePendingCount={stalePendingCount}
            systemStatus={systemStatus}
          />
        ) : null}

        <RecoveryReadinessCard readinessBlockers={readinessBlockers} />

        {latestBackupNotConfirmed ? (
          <AdminCallout tone="warn" title="No se pudo revisar la última copia">El último respaldo exitoso no coincide con el archivo esperado en el servidor local. Cree uno nuevo antes de usarlo para una recuperación.</AdminCallout>
        ) : null}

        {stalePendingCount > 0 ? (
          <AdminCallout tone="warn" title="Respaldos pendientes por demasiado tiempo">{stalePendingCount} respaldo(s) siguen pendientes por más de {stalePendingThresholdMinutes} minutos. Revise el estado del servidor local antes de confiar en la automatización.</AdminCallout>
        ) : null}

        {readinessBlockers.length ? (
          <AdminCallout tone="warn" title="Pendientes antes de operar">{readinessBlockers.join(' - ')}</AdminCallout>
        ) : null}
      </div>
    </details>
  );
}
