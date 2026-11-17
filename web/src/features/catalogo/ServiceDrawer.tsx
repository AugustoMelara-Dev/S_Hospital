import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { formatRateBp } from '@/lib/money';
import { ERYTHROPOIETIN_RULE } from '@/api/types';
import { Button, Drawer, Field, Input, MoneyInput, Select, Switch, Textarea, toast } from '@/ui';
import { type CatalogService, serviceAreaId, serviceCategoryId, serviceTaxId, useAreas, useCategories, useTaxRates } from './api';
import { FormAlert, REASON_MESSAGE, REASON_MIN, applyServerErrors } from './formUtils';

const EXEMPT = 'exento';

type Initial = {
  name: string;
  category_id: string;
  area_id: string;
  price_cents: number | null;
  tax_rate_id: string;
  active: boolean;
  visible_in_billing: boolean;
  is_billable: boolean;
};

function initialOf(s: CatalogService | null, defaultTax: string): Initial {
  if (!s) {
    return {
      name: '',
      category_id: '',
      area_id: '',
      price_cents: null,
      tax_rate_id: defaultTax,
      active: true,
      visible_in_billing: true,
      is_billable: true,
    };
  }
  const tax = serviceTaxId(s);
  return {
    name: s.name,
    category_id: String(serviceCategoryId(s) ?? ''),
    area_id: serviceAreaId(s) === null ? '' : String(serviceAreaId(s)),
    price_cents: s.price_cents,
    tax_rate_id: tax === null ? EXEMPT : String(tax),
    active: s.active,
    visible_in_billing: s.visible_in_billing,
    is_billable: s.is_billable,
  };
}

export type ChangeFlags = { price: boolean; tax: boolean; availability: boolean };

export function changesOf(initial: Initial, v: Pick<Initial, 'price_cents' | 'tax_rate_id' | 'active' | 'visible_in_billing' | 'is_billable'>, isEdit: boolean): ChangeFlags {
  if (!isEdit) return { price: false, tax: false, availability: false };
  return {
    price: v.price_cents !== initial.price_cents,
    tax: v.tax_rate_id !== initial.tax_rate_id,
    availability:
      v.active !== initial.active || v.visible_in_billing !== initial.visible_in_billing || v.is_billable !== initial.is_billable,
  };
}

function buildSchema(initial: Initial, isEdit: boolean) {
  return z
    .object({
      name: z.string().trim().min(1, 'Ingrese el nombre del concepto.').max(160, 'Máximo 160 caracteres.'),
      category_id: z.string().min(1, 'Seleccione una categoría.'),
      area_id: z.string(),
      price_cents: z.number({ error: 'Ingrese un precio válido.' }).int().min(0).nullable(),
      tax_rate_id: z.string().min(1, 'Seleccione la tasa de impuesto.'),
      active: z.boolean(),
      visible_in_billing: z.boolean(),
      is_billable: z.boolean(),
      price_change_reason: z.string(),
      tax_change_reason: z.string(),
      availability_change_reason: z.string(),
    })
    .superRefine((v, ctx) => {
      if (v.price_cents === null) ctx.addIssue({ code: 'custom', path: ['price_cents'], message: 'Ingrese el precio (puede ser L 0.00).' });
      const c = changesOf(initial, v, isEdit);
      const need = (flag: boolean, field: 'price_change_reason' | 'tax_change_reason' | 'availability_change_reason') => {
        if (flag && v[field].trim().length < REASON_MIN) ctx.addIssue({ code: 'custom', path: [field], message: REASON_MESSAGE });
      };
      need(c.price, 'price_change_reason');
      need(c.tax, 'tax_change_reason');
      need(c.availability, 'availability_change_reason');
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;
const FIELDS = [
  'name',
  'category_id',
  'area_id',
  'price_cents',
  'tax_rate_id',
  'price_change_reason',
  'tax_change_reason',
  'availability_change_reason',
] as const;

export type ServiceDrawerProps = { open: boolean; service: CatalogService | null; onClose: () => void };

/** "Nuevo concepto" / "Editar concepto". Remount per service (key) to reset. */
export function ServiceDrawer({ open, service, onClose }: ServiceDrawerProps) {
  const isEdit = service !== null;
  const qc = useQueryClient();
  const categories = useCategories();
  const areas = useAreas();
  const taxes = useTaxRates();
  const defaultTax = useMemo(() => {
    const d = taxes.data?.find((t) => t.is_default && t.active);
    return d ? String(d.id) : '';
  }, [taxes.data]);
  const initial = useMemo(() => initialOf(service, defaultTax), [service, defaultTax]);
  const schema = useMemo(() => buildSchema(initial, isEdit), [initial, isEdit]);
  const formValues = useMemo<FormValues>(
    () => ({ ...initial, price_change_reason: '', tax_change_reason: '', availability_change_reason: '' }),
    [initial],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const isEpo = service?.special_rule_code === ERYTHROPOIETIN_RULE;

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: formValues,
    resetOptions: { keepDirtyValues: true },
  });

  const watched = useWatch({ control });
  const flags = changesOf(
    initial,
    {
      price_cents: watched.price_cents ?? null,
      tax_rate_id: watched.tax_rate_id ?? '',
      active: watched.active ?? initial.active,
      visible_in_billing: watched.visible_in_billing ?? initial.visible_in_billing,
      is_billable: watched.is_billable ?? initial.is_billable,
    },
    isEdit,
  );

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const tax = v.tax_rate_id === EXEMPT ? null : Number(v.tax_rate_id);
      const area = v.area_id === '' ? null : Number(v.area_id);
      if (!service) {
        return api.post<CatalogService>('/services', {
          name: v.name.trim(),
          category_id: Number(v.category_id),
          area_id: area,
          price_cents: v.price_cents ?? 0,
          tax_rate_id: tax,
          active: v.active,
          visible_in_billing: v.visible_in_billing,
          is_billable: v.is_billable,
        });
      }
      // Partial PATCH: only what changed. The API takes a single `reason`.
      const body: Record<string, unknown> = {};
      if (v.name.trim() !== initial.name) body.name = v.name.trim();
      if (v.category_id !== initial.category_id) body.category_id = Number(v.category_id);
      if (v.area_id !== initial.area_id) body.area_id = area;
      if (v.price_cents !== initial.price_cents) body.price_cents = v.price_cents;
      if (v.tax_rate_id !== initial.tax_rate_id) body.tax_rate_id = tax;
      for (const k of ['active', 'visible_in_billing', 'is_billable'] as const) if (v[k] !== initial[k]) body[k] = v[k];
      const c = changesOf(initial, v, true);
      const parts: string[] = [];
      if (c.price) parts.push(`Precio: ${v.price_change_reason.trim()}`);
      if (c.tax) parts.push(`Impuesto: ${v.tax_change_reason.trim()}`);
      if (c.availability) parts.push(`Disponibilidad: ${v.availability_change_reason.trim()}`);
      if (parts.length) body.reason = parts.length === 1 ? parts[0]!.replace(/^[^:]+: /, '') : parts.join(' · ');
      if (Object.keys(body).length === 0) return service;
      return api.patch<CatalogService>(`/services/${service.id}`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(isEdit ? 'Concepto actualizado.' : 'Concepto creado.');
      onClose();
    },
    onError: (e) => {
      const firstReason = flags.price ? 'price_change_reason' : flags.tax ? 'tax_change_reason' : 'availability_change_reason';
      setFormError(applyServerErrors(e, setError, FIELDS, { reason: firstReason }));
    },
  });

  const taxOptions = [
    ...(taxes.data ?? [])
      .filter((t) => t.active || String(t.id) === initial.tax_rate_id)
      .map((t) => ({ value: String(t.id), label: `${t.name} (${formatRateBp(t.rate_bp)})` })),
    { value: EXEMPT, label: 'Exento' },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      dismissible={!save.isPending}
      title={isEdit ? 'Editar concepto' : 'Nuevo concepto'}
      description={isEdit ? 'Los cambios de precio, impuesto o disponibilidad piden motivo y quedan en auditoría.' : 'Producto o servicio facturable en caja.'}
      onSubmit={handleSubmit((v) => {
        setFormError(null);
        save.mutate(v);
      })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear concepto'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {isEpo && (
          <div className="flex gap-3 rounded-[var(--radius-md)] border border-info/30 bg-info-soft px-3.5 py-3 text-[13px] text-ink">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">Regla institucional de eritropoyetina</p>
              <p className="text-ink-2">
                Con receta de diálisis, solo esta línea queda sin cobro; el resto de la cuenta conserva su precio. La regla no se
                puede modificar desde aquí.
              </p>
            </div>
          </div>
        )}
        <Field label="Nombre" required error={errors.name?.message}>
          <Input {...register('name')} autoComplete="off" maxLength={160} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría" required error={errors.category_id?.message}>
            <Select
              {...register('category_id')}
              placeholder="Seleccione…"
              options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.active ? c.name : `${c.name} (inactiva)` }))}
            />
          </Field>
          <Field label="Área" error={errors.area_id?.message}>
            <Select
              {...register('area_id')}
              placeholder="Sin área"
              options={(areas.data ?? []).map((a) => ({ value: String(a.id), label: a.name }))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio" required error={errors.price_cents?.message}>
            <Controller
              control={control}
              name="price_cents"
              render={({ field }) => <MoneyInput value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} name={field.name} />}
            />
          </Field>
          <Field label="Tasa de impuesto" required error={errors.tax_rate_id?.message}>
            <Select {...register('tax_rate_id')} placeholder={taxes.isLoading ? 'Cargando…' : 'Seleccione…'} options={taxOptions} />
          </Field>
        </div>
        {flags.price && (
          <Field label="Motivo del cambio de precio" required error={errors.price_change_reason?.message} className="anim-fade-in">
            <Textarea {...register('price_change_reason')} rows={2} maxLength={500} placeholder="Ej.: Ajuste aprobado por dirección" />
          </Field>
        )}
        {flags.tax && (
          <Field label="Motivo del cambio de impuesto" required error={errors.tax_change_reason?.message} className="anim-fade-in">
            <Textarea {...register('tax_change_reason')} rows={2} maxLength={500} />
          </Field>
        )}

        <fieldset className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-line px-3.5 py-3">
          <legend className="px-1 text-[12.5px] font-medium text-ink-2">Disponibilidad</legend>
          <Controller
            control={control}
            name="active"
            render={({ field }) => <Switch label="Activo" description="Inactivo: no aparece en caja ni se puede facturar." checked={field.value} onCheckedChange={field.onChange} />}
          />
          <Controller
            control={control}
            name="visible_in_billing"
            render={({ field }) => <Switch label="Visible en caja" description="Aparece en el buscador de Cobrar." checked={field.value} onCheckedChange={field.onChange} />}
          />
          <Controller
            control={control}
            name="is_billable"
            render={({ field }) => <Switch label="Facturable" checked={field.value} onCheckedChange={field.onChange} />}
          />
        </fieldset>
        {flags.availability && (
          <Field label="Motivo del cambio de disponibilidad" required error={errors.availability_change_reason?.message} className="anim-fade-in">
            <Textarea {...register('availability_change_reason')} rows={2} maxLength={500} />
          </Field>
        )}
        <FormAlert message={formError} />
      </div>
    </Drawer>
  );
}
