import { useEffect, useRef, useState } from 'react';

import { AdminCallout, AdminPanel, AdminPanelHeader } from '@/design-system/admin/components';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import { type OperationalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { CHECKBOX_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from './settingsUi';

type OperationalRulesViewProps = { canEdit: boolean; onStatus: OperationalStatusReporter };

export function OperationalRulesView({ canEdit, onStatus }: OperationalRulesViewProps) {
  const [settings, setSettings] = useState<OperationalSettings | null>(null);
  const [partialPaymentsEnabled, setPartialPaymentsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorScope, setErrorScope] = useState<'load' | 'save'>('load');
  const savingRef = useRef(false);

  const rulesDirty = settings !== null && partialPaymentsEnabled !== (settings.partial_payments_enabled === true);
  useUnsavedChangesGuard(rulesDirty);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.getOperationalSettings();
      setSettings(data);
      setPartialPaymentsEnabled(data?.partial_payments_enabled === true);
    } catch (err) {
      setErrorScope('load');
      setError(safeClientMessage(userSafeErrorMessage(err, 'No se pudo cargar reglas operativas.')));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit() {
    if (savingRef.current || !settings) return;
    savingRef.current = true;
    setError('');
    onStatus({ key: 'settings:operational-rules:save', level: 'info', message: 'Guardando reglas operativas...', toast: false });
    try {
      const updated = await apiClient.updateOperationalSettings({ scanner_enabled: false, partial_payments_enabled: partialPaymentsEnabled });
      setSettings((current) => (current ? { ...current, ...updated } : current));
      onStatus({ key: 'settings:operational-rules:save', level: 'success', message: 'Reglas operativas guardadas.' });
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo guardar reglas operativas.'));
      setErrorScope('save');
      setError(message);
      onStatus({ key: 'settings:operational-rules:save', level: 'error', message });
    } finally {
      savingRef.current = false;
    }
  }

  if (loading) return <div role="status" aria-live="polite" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">Cargando reglas operativas...</div>;

  return (
    <AdminPanel as="section" aria-labelledby="operational-rules-title">
      <AdminPanelHeader
        id="operational-rules-title"
        title="Reglas operativas"
        description="Opciones para el cobro diario. Los cambios quedan auditados."
      />
      <div className="grid gap-4 p-4">
        {settings === null && errorScope === 'load' && error ? (
          // Sin datos vigentes no se dibuja el interruptor: mostrarlo apagado
          // afirmaría que los abonos parciales están desactivados.
          <AdminCallout tone="error" title="No se pudieron cargar las reglas operativas">
            {error}
            <div className="mt-3">
              <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => void load()}>
                Reintentar carga
              </button>
            </div>
          </AdminCallout>
        ) : (
          <>
            {error ? (
              <AdminCallout tone="error" title="No se pudieron guardar las reglas operativas">
                {error}
              </AdminCallout>
            ) : null}

            <fieldset className="grid gap-3">
              <legend className="text-[length:var(--ui-text-sm)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">Punto de venta</legend>
              <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Active o desactive funciones del flujo de facturación.</p>
              <label htmlFor="partial_payments_enabled" className="flex items-start gap-3 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-4">
                <input
                  id="partial_payments_enabled"
                  type="checkbox"
                  className={`mt-0.5 ${CHECKBOX_CLASS}`}
                  checked={partialPaymentsEnabled}
                  onChange={(event) => setPartialPaymentsEnabled(event.target.checked)}
                  disabled={!canEdit}
                />
                {/* El título vive como texto directo del `span` contenedor: con
                    un `span` anidado más el texto quedaba a 3 niveles del
                    `label` y jsx-a11y (`depth: 2`) no encontraba texto
                    accesible → warning `label-has-associated-control`. El
                    render es el mismo: el contenedor hereda text-sm/medium/ink
                    y la descripción mantiene su propio tamaño y peso. */}
                <span className="min-w-0 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">
                  Permitir abonos parciales
                  <span className="mt-0.5 block text-[length:var(--ui-text-xs)] font-normal text-[color:var(--ui-ink-soft)]">Si está desactivado, un monto menor al total no se registra como pago completo.</span>
                </span>
              </label>
            </fieldset>

            <div className="flex justify-end">
              <button type="button" data-ui-press className={PRIMARY_BUTTON} onClick={onSubmit} disabled={!canEdit || settings === null}>
                Guardar reglas operativas
              </button>
            </div>
          </>
        )}
      </div>
    </AdminPanel>
  );
}
