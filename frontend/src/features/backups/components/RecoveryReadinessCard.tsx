import { LifeBuoy, RotateCcw } from 'lucide-react';
import { AdminPanel } from '@/design-system/admin/components';
import { SECONDARY_BUTTON } from '../backupsUi';

type RecoveryReadinessCardProps = {
  readinessBlockers: string[];
};

export function RecoveryReadinessCard({ readinessBlockers }: RecoveryReadinessCardProps) {
  const titleId = 'local-recovery-title';

  return (
    <section aria-labelledby={titleId}>
      <AdminPanel as="div">
        <div className="border-b border-[var(--ui-line)] p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--ui-radius)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface-alt)] text-[color:var(--ui-action)]">
              <RotateCcw aria-hidden="true" className="size-5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-[length:var(--ui-text-lg)] font-semibold text-[color:var(--ui-ink)]">Restauración local</h2>
              <p className="mt-0.5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
                Recuperación protegida para la computadora donde está instalado S_Hospital.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div className="space-y-2 text-[length:var(--ui-text-sm)] leading-relaxed text-[color:var(--ui-ink)]">
            <p>Use el acceso “Respaldos y recuperación de S_Hospital” en esta computadora.</p>
            <p className="text-[color:var(--ui-ink-soft)]">
              La restauración detiene temporalmente el sistema y crea un respaldo preventivo.
            </p>
          </div>

          {readinessBlockers.length > 0 ? (
            <div className="rounded-[var(--ui-radius)] border border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] p-3">
              <p className="mb-2 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-warn)]">Pendientes antes de recuperar</p>
              <ul aria-label="Pendientes para recuperación" className="list-disc space-y-1 pl-5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
                {readinessBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            </div>
          ) : (
            <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">Sin pendientes de preparación detectados.</p>
          )}

          <div>
            <a href="/support" className={SECONDARY_BUTTON}>
              <LifeBuoy aria-hidden="true" className="size-4" strokeWidth={1.5} />
              Abrir centro de soporte
            </a>
          </div>
        </div>
      </AdminPanel>
    </section>
  );
}
