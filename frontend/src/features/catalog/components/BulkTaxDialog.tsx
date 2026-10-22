import { useEffect, useRef, useState } from 'react';
import { AdminCallout, AdminDialog, AdminField } from '@/design-system/admin/components';
import { type Category, type Service, type TaxRate, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import { formatTaxPercentage, taxRateReasonError } from '@/features/settings/taxRatesFormat';
import { CHECKBOX_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON, SELECT_CLASS, TEXTAREA_CLASS } from './catalogUi';

type BulkTaxScope = 'category' | 'selection';

type BulkTaxDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  services: Service[];
  taxRates: TaxRate[];
  canManage: boolean;
  onApplied: (updated: number) => void;
  onStatus: OperationalStatusReporter;
};

/**
 * Edición de impuesto en lote (H-15).
 *
 * El alcance se declara explícitamente: todos los conceptos de una categoría o
 * los seleccionados de la página visible. El motivo es obligatorio y el
 * resultado lo confirma el backend (`updated`); la UI no simula el cambio.
 */
export function BulkTaxDialog({
  open,
  onOpenChange,
  categories,
  services,
  taxRates,
  canManage,
  onApplied,
  onStatus,
}: BulkTaxDialogProps) {
  const [scope, setScope] = useState<BulkTaxScope>('category');
  const [categoryId, setCategoryId] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [taxRateChoice, setTaxRateChoice] = useState<number | null | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setScope('category');
    setCategoryId(categories[0] ? String(categories[0].id) : '');
    setSelectedIds([]);
    setTaxRateChoice(taxRates.find((rate) => rate.is_default)?.id ?? undefined);
    setReason('');
    setError('');
    setSaving(false);
    setShowValidation(false);
  }, [open, categories, taxRates]);

  const selectionInvalid = scope === 'selection' && selectedIds.length === 0;
  const categoryInvalid = scope === 'category' && categoryId === '';
  const taxInvalid = taxRateChoice === undefined;
  const reasonError = reason.length > 0 ? taxRateReasonError(reason) : null;
  const ruleError = selectionInvalid
    ? 'Seleccione al menos un concepto.'
    : categoryInvalid
      ? 'Seleccione una categoría.'
      : taxInvalid
        ? 'Elija la tasa que se aplicará.'
        : null;

  function toggleService(id: number) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((candidate) => candidate !== id)
      : [...current, id]);
  }

  async function apply() {
    if (saving) return;

    const invalidReason = taxRateReasonError(reason);
    if (invalidReason) {
      setError(invalidReason);
      return;
    }
    if (ruleError) {
      setShowValidation(true);
      setError('');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await apiClient.bulkUpdateServiceTax({
        ...(scope === 'category'
          ? { category_id: Number(categoryId) }
          : { service_ids: selectedIds }),
        tax_rate_id: taxRateChoice ?? null,
        reason: reason.trim(),
      });
      onApplied(updated);
      onStatus({
        key: 'catalog:bulk-tax',
        level: 'success',
        message: updated === 1
          ? 'Impuesto actualizado en 1 concepto.'
          : `Impuesto actualizado en ${updated} conceptos.`,
      });
      onOpenChange(false);
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo actualizar el impuesto del catálogo.'));
      setError(message);
      onStatus({ key: 'catalog:bulk-tax', level: 'error', message });
    } finally {
      setSaving(false);
    }
  }

  const taxRateLabel = taxRateChoice === undefined
    ? 'Sin elegir'
    : taxRateChoice === null
      ? 'Exento (sin impuesto)'
      : taxRates.find((rate) => rate.id === taxRateChoice)?.name ?? 'Tasa no disponible';

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => { if (!saving) onOpenChange(next); }}
      className="sm:max-w-2xl"
      title="Editar impuestos en lote"
      description="Reasigne la tasa de varios conceptos con un solo motivo auditado. Las facturas ya emitidas no cambian."
      closeDisabled={saving}
      footer={(
        <>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button
            type="button"
            data-ui-press
            className={PRIMARY_BUTTON}
            disabled={saving || !canManage || taxRates.length === 0}
            onClick={() => void apply()}
          >
            {saving ? 'Aplicando…' : 'Aplicar a los conceptos'}
          </button>
        </>
      )}
    >
      <div className="grid gap-4">
        {error ? <AdminCallout tone="error" title="No se pudo aplicar el cambio">{error}</AdminCallout> : null}
        {taxRates.length === 0 ? (
          <AdminCallout tone="warn" title="Sin tasas configuradas">
            Cree primero las tasas en <strong>Ajustes → Impuestos</strong>. Sin tasas no hay nada que asignar.
          </AdminCallout>
        ) : null}

        <fieldset className="grid gap-2">
          <legend className="text-[length:var(--ui-text-sm)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-soft)]">Alcance</legend>
          <label htmlFor="bulk-tax-scope-category" className="flex items-start gap-3 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-3 text-[length:var(--ui-text-sm)]">
            <input
              id="bulk-tax-scope-category"
              type="radio"
              name="bulk-tax-scope"
              className={`mt-0.5 ${CHECKBOX_CLASS}`}
              checked={scope === 'category'}
              disabled={saving}
              onChange={() => setScope('category')}
            />
            <span>
              Toda una categoría
              <span className="mt-0.5 block text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                Incluye los conceptos activos e inactivos de la categoría.
              </span>
            </span>
          </label>
          <label htmlFor="bulk-tax-scope-selection" className="flex items-start gap-3 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-3 text-[length:var(--ui-text-sm)]">
            <input
              id="bulk-tax-scope-selection"
              type="radio"
              name="bulk-tax-scope"
              className={`mt-0.5 ${CHECKBOX_CLASS}`}
              checked={scope === 'selection'}
              disabled={saving}
              onChange={() => setScope('selection')}
            />
            <span>
              Conceptos seleccionados
              <span className="mt-0.5 block text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                Sólo los de esta página del catálogo.
              </span>
            </span>
          </label>
        </fieldset>

        {scope === 'category' ? (
          <AdminField htmlFor="bulk-tax-category" label="Categoría" required error={categoryInvalid ? 'Seleccione una categoría.' : undefined}>
            <select
              id="bulk-tax-category"
              className={SELECT_CLASS}
              value={categoryId}
              disabled={saving || categories.length === 0}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Seleccione…</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>{category.name}</option>
              ))}
            </select>
          </AdminField>
        ) : (
          <fieldset className="grid gap-2">
            <legend className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]">
              Conceptos de esta página
            </legend>
            {services.length === 0 ? (
              <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">No hay conceptos visibles para seleccionar.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-[var(--ui-radius)] border border-[var(--ui-line)]">
                <ul className="divide-y divide-[var(--ui-line)]">
                  {services.map((service) => (
                    <li key={service.id} className="flex items-center gap-2 px-3 py-2">
                      <input
                        id={`bulk-tax-service-${service.id}`}
                        type="checkbox"
                        className={CHECKBOX_CLASS}
                        checked={selectedIds.includes(service.id)}
                        disabled={saving}
                        onChange={() => toggleService(service.id)}
                      />
                      <label htmlFor={`bulk-tax-service-${service.id}`} className="min-w-0 flex-1 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)]">
                        <span className="block truncate">{service.name}</span>
                        <span className="block text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{service.category?.name ?? 'Sin categoría'}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]" role="status">
              {selectedIds.length} concepto{selectedIds.length === 1 ? '' : 's'} seleccionado{selectedIds.length === 1 ? '' : 's'}.
            </p>
          </fieldset>
        )}

        <AdminField htmlFor="bulk-tax-rate" label="Tasa que se aplicará" required hint="Elija «Exento» para dejar los conceptos sin impuesto.">
          <select
            id="bulk-tax-rate"
            className={SELECT_CLASS}
            value={taxRateChoice === undefined ? '' : taxRateChoice === null ? 'exempt' : String(taxRateChoice)}
            disabled={saving || taxRates.length === 0}
            onChange={(event) => {
              const value = event.target.value;
              setTaxRateChoice(value === '' ? undefined : value === 'exempt' ? null : Number(value));
            }}
          >
            <option value="">Seleccione…</option>
            <option value="exempt">Exento (sin impuesto)</option>
            {taxRates.map((rate) => (
              <option key={rate.id} value={String(rate.id)}>
                {rate.name} · {formatTaxPercentage(rate.percentage)}
                {rate.is_default ? ' · Predeterminada' : ''}
                {rate.active ? '' : ' (inactiva)'}
              </option>
            ))}
          </select>
        </AdminField>

        <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]" role="status">
          Se aplicará <strong className="text-[color:var(--ui-ink)]">{taxRateLabel}</strong> a{' '}
          {scope === 'category' ? 'todos los conceptos de la categoría elegida' : `${selectedIds.length} concepto(s) seleccionado(s)`}.
        </p>

        {ruleError && showValidation ? (
          <p role="alert" className="text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-danger)]">
            {ruleError}
          </p>
        ) : null}

        <AdminField
          htmlFor="bulk-tax-reason"
          label="Motivo del cambio"
          required
          hint="Mínimo 5 caracteres. Queda registrado en la auditoría."
          error={reasonError ?? undefined}
        >
          <textarea
            id="bulk-tax-reason"
            rows={3}
            className={TEXTAREA_CLASS}
            value={reason}
            disabled={saving}
            placeholder="Ej. Revisión de impuestos solicitada por administración"
            onChange={(event) => setReason(event.target.value)}
          />
        </AdminField>

        <p className="sr-only" aria-live="polite">{showValidation ? ruleError ?? '' : ''}</p>
        <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
          La tasa predeterminada del sistema no se modifica con esta acción.
        </p>
      </div>
    </AdminDialog>
  );
}
