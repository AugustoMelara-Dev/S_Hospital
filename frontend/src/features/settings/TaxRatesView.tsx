import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import {
  AdminCallout,
  AdminChip,
  AdminDialog,
  AdminEmpty,
  AdminField,
  AdminPanel,
  AdminPanelHeader,
  AdminTable,
  type AdminColumn,
} from '@/design-system/admin/components';
import { type TaxRate, ApiError, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import { CHECKBOX_CLASS, INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON, TEXTAREA_CLASS } from './settingsUi';
import {
  TAX_RATE_NAME_MAX_LENGTH,
  formatTaxPercentage,
  normalizeTaxPercentage,
  taxRateIsExempt,
  taxRateReasonError,
} from './taxRatesFormat';

type TaxRatesViewProps = {
  canEdit: boolean;
  onStatus: OperationalStatusReporter;
};

const PERCENTAGE_MESSAGE = 'Use un porcentaje entre 0 y 99.99, con hasta dos decimales.';

const taxRateSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Indique el nombre de la tasa.')
    .max(TAX_RATE_NAME_MAX_LENGTH, `El nombre no puede superar ${TAX_RATE_NAME_MAX_LENGTH} caracteres.`),
  percentage: z.string()
    .trim()
    .min(1, 'Indique el porcentaje.')
    .refine((value) => normalizeTaxPercentage(value) !== null, PERCENTAGE_MESSAGE),
  active: z.boolean(),
  is_default: z.boolean(),
  reason: z.string().max(255, 'El motivo no puede superar 255 caracteres.'),
});

type TaxRateFormData = z.infer<typeof taxRateSchema>;

const DEFAULT_FORM_VALUES: TaxRateFormData = {
  name: '',
  percentage: '',
  active: true,
  is_default: false,
  reason: '',
};

function defaultFormValues(rate: TaxRate | null): TaxRateFormData {
  if (!rate) return DEFAULT_FORM_VALUES;

  return {
    name: rate.name,
    percentage: normalizeTaxPercentage(rate.percentage) ?? rate.percentage,
    active: rate.active,
    is_default: rate.is_default,
    reason: '',
  };
}

/**
 * Ajustes → Impuestos.
 *
 * Lista y administra las tasas configurables. La pantalla no calcula totales:
 * sólo declara qué tasa elige cada producto. Toda mutación exige motivo y el
 * backend conserva el motivo en la auditoría. Las facturas ya emitidas llevan
 * su impuesto grabado por línea y no cambian desde aquí.
 */
export function TaxRatesView({ canEdit, onStatus }: TaxRatesViewProps) {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formTarget, setFormTarget] = useState<TaxRate | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaxRate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rates = await apiClient.getTaxRates();
      setTaxRates(rates);
    } catch (err) {
      setLoadError(safeClientMessage(userSafeErrorMessage(err, 'No se pudieron cargar las tasas de impuesto.')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaved = useCallback((saved: TaxRate) => {
    setTaxRates((current) => {
      const next = current.some((rate) => rate.id === saved.id)
        ? current.map((rate) => (rate.id === saved.id ? saved : rate))
        : [...current, saved];

      return next
        .map((rate) => (rate.id === saved.id ? rate : { ...rate, is_default: saved.is_default ? false : rate.is_default }))
        .sort((left, right) => {
          if (left.is_default !== right.is_default) return left.is_default ? -1 : 1;
          const percentage = Number(left.percentage) - Number(right.percentage);
          return percentage !== 0 ? percentage : left.name.localeCompare(right.name, 'es');
        });
    });
  }, []);

  const columns: Array<AdminColumn<TaxRate>> = [
    {
      key: 'name',
      header: 'Tasa',
      mobilePrimary: true,
      cell: (rate) => (
        <div className="min-w-0">
          <span className="block font-semibold text-[color:var(--ui-ink)] [overflow-wrap:anywhere]">{rate.name}</span>
          <span className="block text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
            {taxRateIsExempt(rate) ? 'Sin impuesto para la línea' : 'Grava la línea al cobrar'}
          </span>
        </div>
      ),
    },
    {
      key: 'percentage',
      header: 'Porcentaje',
      align: 'right',
      cell: (rate) => <span className="tabular-nums font-semibold text-[color:var(--ui-ink)]">{formatTaxPercentage(rate.percentage)}</span>,
    },
    {
      key: 'state',
      header: 'Estado',
      cell: (rate) => (
        <AdminChip tone={rate.active ? 'success' : 'neutral'}>{rate.active ? 'Activa' : 'Inactiva'}</AdminChip>
      ),
    },
    {
      key: 'default',
      header: 'Predeterminada',
      cell: (rate) => (
        rate.is_default
          ? <AdminChip tone="neutral">Predeterminada</AdminChip>
          : <span className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">—</span>
      ),
    },
  ];

  if (canEdit) {
    columns.push({
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      cell: (rate) => (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            data-ui-press
            className={SECONDARY_BUTTON}
            onClick={() => setFormTarget(rate)}
            aria-label={`Editar tasa ${rate.name}`}
          >
            <PencilIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />Editar
          </button>
          <button
            type="button"
            data-ui-press
            className={SECONDARY_BUTTON}
            onClick={() => setDeleteTarget(rate)}
            aria-label={`Eliminar tasa ${rate.name}`}
          >
            <Trash2Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />Eliminar
          </button>
        </div>
      ),
    });
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
        Cargando tasas de impuesto…
      </div>
    );
  }

  return (
    <section className="grid gap-4">
      <AdminPanel as="section" aria-labelledby="tax-rates-title">
        <AdminPanelHeader
          id="tax-rates-title"
          title="Impuestos"
          description="Tasas de ISV que puede elegir cada producto del catálogo. Cada cambio exige motivo y queda auditado."
          actions={canEdit ? (
            <button type="button" data-ui-press className={PRIMARY_BUTTON} onClick={() => setFormTarget('new')}>
              <PlusIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />Nueva tasa
            </button>
          ) : (
            <AdminChip tone="neutral">Solo lectura</AdminChip>
          )}
        />
        <div className="grid gap-4 p-4">
          {loadError ? (
            <AdminCallout tone="error" title="No se pudieron cargar las tasas">
              <p>{loadError}</p>
              <button type="button" data-ui-press className={`${SECONDARY_BUTTON} mt-3`} onClick={() => void load()}>
                Reintentar carga
              </button>
            </AdminCallout>
          ) : null}

          <AdminCallout tone="info" title="Cambios con efecto hacia adelante">
            <p>
              Cambiar o eliminar una tasa afecta a las <strong>facturas nuevas</strong>. Las facturas ya emitidas
              conservan el impuesto con el que se grabaron y no se recalculan.
            </p>
            <p className="mt-2">
              «Exento» se representa con una tasa de 0 % o sin tasa asignada en el producto. La tasa predeterminada
              se usa como sugerencia al crear conceptos.
            </p>
          </AdminCallout>

          {!loadError ? (
            <AdminTable<TaxRate>
              caption="Tasas de impuesto configuradas"
              columns={columns}
              rows={taxRates}
              getRowKey={(rate) => String(rate.id)}
              minTableWidth="40rem"
              empty={(
                <AdminEmpty
                  title="Todavía no hay tasas de impuesto"
                  description="Cree al menos «Exento 0 %» y, si su institución lo cobra, la tasa de ISV autorizada. Sin tasas, el catálogo se cobra exento."
                  action={canEdit ? (
                    <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => setFormTarget('new')}>
                      Crear la primera tasa
                    </button>
                  ) : undefined}
                />
              )}
            />
          ) : null}
        </div>
      </AdminPanel>

      {canEdit ? (
        <>
          <TaxRateFormDialog
            key={formTarget === 'new' ? 'new' : formTarget?.id ?? 'closed'}
            open={formTarget !== null}
            rate={formTarget === 'new' ? null : formTarget}
            onOpenChange={(open) => { if (!open) setFormTarget(null); }}
            onSaved={(saved, created) => {
              handleSaved(saved);
              setFormTarget(null);
              onStatus({
                key: 'settings:tax-rate:save',
                level: 'success',
                message: created ? 'Tasa de impuesto creada.' : 'Tasa de impuesto actualizada.',
              });
            }}
            onStatus={onStatus}
          />

          <DeleteTaxRateDialog
            key={deleteTarget?.id ?? 'closed-delete'}
            rate={deleteTarget}
            onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
            onDeleted={(deleted) => {
              setTaxRates((current) => current.filter((rate) => rate.id !== deleted.id));
              setDeleteTarget(null);
              onStatus({ key: 'settings:tax-rate:delete', level: 'success', message: 'Tasa de impuesto eliminada.' });
            }}
            onStatus={onStatus}
          />
        </>
      ) : null}
    </section>
  );
}

function TaxRateFormDialog({
  open,
  rate,
  onOpenChange,
  onSaved,
  onStatus,
}: {
  open: boolean;
  rate: TaxRate | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (saved: TaxRate, created: boolean) => void;
  onStatus: OperationalStatusReporter;
}) {
  const [submitError, setSubmitError] = useState('');
  const savingRef = useRef(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TaxRateFormData>({
    resolver: zodResolver(taxRateSchema),
    defaultValues: defaultFormValues(rate),
  });

  useEffect(() => {
    if (open) {
      setSubmitError('');
      reset(defaultFormValues(rate));
    }
  }, [open, rate, reset]);

  async function submit(data: TaxRateFormData) {
    if (savingRef.current) return;

    const reasonError = taxRateReasonError(data.reason);
    if (reasonError) {
      setError('reason', { type: 'manual', message: reasonError });
      return;
    }

    const percentage = normalizeTaxPercentage(data.percentage);
    if (percentage === null) {
      setError('percentage', { type: 'manual', message: PERCENTAGE_MESSAGE });
      return;
    }

    savingRef.current = true;
    setSubmitError('');
    const payload = {
      name: data.name.trim(),
      percentage,
      active: data.active,
      is_default: data.is_default,
      reason: data.reason.trim(),
    };

    try {
      const saved = rate
        ? await apiClient.updateTaxRate(rate.id, payload)
        : await apiClient.createTaxRate(payload);
      onSaved(saved, rate === null);
      reset(defaultFormValues(null));
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo guardar la tasa de impuesto.'));
      if (err instanceof ApiError && err.validationErrors) {
        Object.entries(err.validationErrors).forEach(([field, messages]) => {
          const target = field as keyof TaxRateFormData;
          if (target in DEFAULT_FORM_VALUES) {
            setError(target, { type: 'server', message: messages[0] });
          }
        });
      }
      setSubmitError(message);
      onStatus({ key: 'settings:tax-rate:save', level: 'error', message });
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-xl"
      title={rate ? `Editar ${rate.name}` : 'Nueva tasa de impuesto'}
      description="El nombre y el porcentaje se usan en el catálogo y en las facturas nuevas."
      closeDisabled={isSubmitting}
      footer={(
        <>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button type="submit" form="tax-rate-form" data-ui-press className={PRIMARY_BUTTON} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : rate ? 'Guardar cambios' : 'Crear tasa'}
          </button>
        </>
      )}
    >
      <form id="tax-rate-form" className="grid gap-4" onSubmit={handleSubmit(submit)}>
        {submitError ? <AdminCallout tone="error" title="No se pudo guardar">{submitError}</AdminCallout> : null}

        <AdminField htmlFor="tax-rate-name" label="Nombre" required error={errors.name?.message}>
          <input
            id="tax-rate-name"
            className={INPUT_CLASS}
            placeholder="ISV 15 %"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </AdminField>

        <AdminField
          htmlFor="tax-rate-percentage"
          label="Porcentaje"
          required
          hint="0 = exento. Escriba el porcentaje que autoriza la institución, no lo calcule desde facturas."
          error={errors.percentage?.message}
        >
          <input
            id="tax-rate-percentage"
            className={INPUT_CLASS}
            inputMode="decimal"
            placeholder="15.00"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.percentage)}
            {...register('percentage')}
          />
        </AdminField>

        <div className="grid gap-3 rounded-[var(--ui-radius)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] p-4">
          <label htmlFor="tax-rate-active" className="flex items-start gap-3 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)]">
            <input id="tax-rate-active" type="checkbox" className={`mt-0.5 ${CHECKBOX_CLASS}`} disabled={isSubmitting} {...register('active')} />
            <span>
              Tasa activa
              <span className="mt-0.5 block text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                Una tasa inactiva no se ofrece para nuevos conceptos, pero los que ya la usan no cambian.
              </span>
            </span>
          </label>
          <label htmlFor="tax-rate-default" className="flex items-start gap-3 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)]">
            <input id="tax-rate-default" type="checkbox" className={`mt-0.5 ${CHECKBOX_CLASS}`} disabled={isSubmitting} {...register('is_default')} />
            <span>
              Tasa predeterminada
              <span className="mt-0.5 block text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                Sólo puede haber una. Al marcarla, la anterior deja de serlo.
              </span>
            </span>
          </label>
        </div>

        <AdminField
          htmlFor="tax-rate-reason"
          label="Motivo del cambio"
          required
          hint="Mínimo 5 caracteres. Queda registrado en la auditoría del sistema."
          error={errors.reason?.message}
        >
          <textarea
            id="tax-rate-reason"
            rows={3}
            className={TEXTAREA_CLASS}
            placeholder="Ej. Tasa autorizada por el SAR para 2026"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.reason)}
            {...register('reason')}
          />
        </AdminField>
      </form>
    </AdminDialog>
  );
}

function DeleteTaxRateDialog({
  rate,
  onOpenChange,
  onDeleted,
  onStatus,
}: {
  rate: TaxRate | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (deleted: TaxRate) => void;
  onStatus: OperationalStatusReporter;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const reasonError = reason.length > 0 ? taxRateReasonError(reason) : null;

  useEffect(() => {
    setReason('');
    setError('');
    setDeleting(false);
  }, [rate?.id]);

  async function confirmDelete() {
    if (!rate || deleting) return;

    const invalidReason = taxRateReasonError(reason);
    if (invalidReason) {
      setError('');
      return;
    }

    setDeleting(true);
    setError('');
    try {
      await apiClient.deleteTaxRate(rate.id, reason.trim());
      onDeleted(rate);
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo eliminar la tasa de impuesto.'));
      setError(message);
      onStatus({ key: 'settings:tax-rate:delete', level: 'error', message });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminDialog
      open={rate !== null}
      onOpenChange={(open) => { if (!open && !deleting) onOpenChange(false); }}
      title="Eliminar tasa de impuesto"
      description={rate ? `${rate.name} (${formatTaxPercentage(rate.percentage)})` : undefined}
      closeDisabled={deleting}
      footer={(
        <>
          <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={deleting} onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button type="button" data-ui-press className={PRIMARY_BUTTON} disabled={deleting || reason.trim().length === 0} onClick={() => void confirmDelete()}>
            {deleting ? 'Eliminando…' : 'Eliminar tasa'}
          </button>
        </>
      )}
    >
      <div className="grid gap-4">
        {error ? <AdminCallout tone="error" title="No se pudo eliminar">{error}</AdminCallout> : null}
        <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)]">
          Esta acción no se puede deshacer. Si la tasa está asignada a productos, el sistema no permitirá eliminarla:
          en ese caso reasigne los conceptos o desactívela.
        </p>
        <AdminField
          htmlFor="tax-rate-delete-reason"
          label="Motivo de la eliminación"
          required
          hint="Mínimo 5 caracteres. Queda registrado en la auditoría."
          error={reasonError}
        >
          <textarea
            id="tax-rate-delete-reason"
            rows={3}
            className={TEXTAREA_CLASS}
            value={reason}
            disabled={deleting}
            aria-invalid={Boolean(reasonError)}
            onChange={(event) => setReason(event.target.value)}
          />
        </AdminField>
      </div>
    </AdminDialog>
  );
}
