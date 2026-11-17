import { useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ImageUp, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/api/queryClient';
import type { Settings } from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { Button, Card, Field, Input, Skeleton, Textarea, toast } from '@/ui';
import { FormAlert, REASON_MESSAGE, REASON_MIN, applyServerErrors } from '@/features/catalogo/formUtils';

export function useSettings(enabled = true) {
  return useQuery({ queryKey: qk.settings, enabled, queryFn: () => api.get<Settings>('/settings') });
}

const TEXT_FIELDS = [
  { name: 'hospital_name', label: 'Nombre del hospital', max: 160, required: true },
  { name: 'rtn', label: 'RTN', max: 20 },
  { name: 'address', label: 'Dirección', max: 255 },
  { name: 'phone', label: 'Teléfono', max: 60 },
  { name: 'slogan', label: 'Lema', max: 160 },
  { name: 'government_line', label: 'Dependencia superior', max: 160 },
  { name: 'secretariat_line', label: 'Secretaría', max: 160 },
  { name: 'receipt_location', label: 'Lugar del recibo', max: 160 },
] as const;

type TextName = (typeof TEXT_FIELDS)[number]['name'] | 'receipt_footer_text';

function ReceiptHeaderPreview({ v, logoSrc }: { v: Partial<Record<TextName, string>>; logoSrc: string | null }) {
  return (
    <div aria-label="Vista previa del encabezado del recibo" className="rounded-[var(--radius-md)] border border-line bg-white p-4 text-[#1B1F1D] shadow-1">
      <div className="flex items-start gap-3">
        {logoSrc ? (
          <img src={logoSrc} alt="" className="size-12 shrink-0 rounded-[4px] object-contain outline outline-1 -outline-offset-1 outline-black/10" />
        ) : (
          <div className="size-12 shrink-0 rounded-[4px] border border-dashed border-[#DAD6CC]" aria-hidden="true" />
        )}
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          {v.government_line && <p className="text-[10px] tracking-wide uppercase">{v.government_line}</p>}
          {v.secretariat_line && <p className="text-[10px] uppercase">{v.secretariat_line}</p>}
          <p className="text-[13px] font-bold uppercase">{v.hospital_name || 'Nombre del hospital'}</p>
          {v.address && <p className="text-[10px]">{v.address}</p>}
          {v.receipt_location && <p className="text-[10px]">{v.receipt_location}</p>}
          <p className="text-[10px]">{[v.rtn && `RTN ${v.rtn}`, v.phone && `Tel. ${v.phone}`].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-y border-[#1B1F1D] py-1 text-[10px] font-bold tracking-[0.1em]">
        <span>RECIBO INSTITUCIONAL</span>
        <span className="font-mono" style={{ color: '#b91c1c' }}>
          Recibo No. REC-A-00000001
        </span>
      </div>
    </div>
  );
}

export function IdentidadTab() {
  const { can } = usePermissions();
  const canEdit = can('settings.update');
  const qc = useQueryClient();
  const q = useSettings();
  const s = q.data;
  const fileRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const initial = useMemo(
    () => ({
      hospital_name: s?.hospital_name ?? '',
      rtn: s?.rtn ?? '',
      address: s?.address ?? '',
      phone: s?.phone ?? '',
      slogan: s?.slogan ?? '',
      government_line: s?.government_line ?? '',
      secretariat_line: s?.secretariat_line ?? '',
      receipt_location: s?.receipt_location ?? '',
      receipt_footer_text: s?.receipt_footer_text ?? '',
      reason: '',
    }),
    [s],
  );
  const schema = useMemo(
    () =>
      z
        .object({
          hospital_name: z.string().trim().min(1, 'Ingrese el nombre del hospital.'),
          rtn: z.string().trim().regex(/^[0-9-]*$/, 'Use solo números y guiones.').max(20),
          address: z.string(),
          phone: z.string(),
          slogan: z.string(),
          government_line: z.string(),
          secretariat_line: z.string(),
          receipt_location: z.string(),
          receipt_footer_text: z.string().max(2000),
          reason: z.string(),
        })
        .superRefine((v, ctx) => {
          if (v.rtn.trim() !== initial.rtn && v.reason.trim().length < REASON_MIN) {
            ctx.addIssue({ code: 'custom', path: ['reason'], message: REASON_MESSAGE });
          }
        }),
    [initial],
  );
  type V = z.infer<typeof schema>;
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<V>({ resolver: zodResolver(schema), values: initial });
  const watched = useWatch({ control });
  const rtnChanged = (watched.rtn ?? '').trim() !== initial.rtn;

  const save = useMutation({
    mutationFn: (v: V) => {
      const body: Record<string, unknown> = {};
      for (const k of Object.keys(initial) as Array<keyof V>) {
        if (k !== 'reason' && v[k].trim() !== initial[k]) body[k] = v[k].trim();
      }
      if (rtnChanged) body.reason = v.reason.trim();
      return api.put<Settings>('/settings', body);
    },
    onSuccess: (data) => {
      qc.setQueryData(qk.settings, data);
      void qc.invalidateQueries({ queryKey: qk.branding });
      toast.success('Ajustes guardados.');
    },
    onError: (e) => setFormError(applyServerErrors(e, setError, [...Object.keys(initial)])),
  });

  const logoVersion = s?.updated_at ?? '';
  const logoSrc = s?.has_logo ? `/api/branding/logo?v=${encodeURIComponent(logoVersion)}` : null;

  const uploadLogo = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post<Settings>('/settings/logo', fd);
    },
    onSuccess: (data) => {
      if (data) qc.setQueryData(qk.settings, data);
      void qc.invalidateQueries({ queryKey: qk.settings });
      void qc.invalidateQueries({ queryKey: qk.branding });
      toast.success('Logo actualizado.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const removeLogo = useMutation({
    mutationFn: () => api.delete<Settings>('/settings/logo'),
    onSuccess: (data) => {
      if (data) qc.setQueryData(qk.settings, data);
      void qc.invalidateQueries({ queryKey: qk.settings });
      void qc.invalidateQueries({ queryKey: qk.branding });
      toast.success('Logo eliminado.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <Skeleton lines={8} />;
  if (q.isError) return <FormAlert message={errorMessage(q.error)} />;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card title="Identidad institucional" description="Aparece en los recibos y documentos impresos.">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((v) => {
            setFormError(null);
            save.mutate(v);
          })}
        >
          <fieldset disabled={!canEdit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TEXT_FIELDS.map((f) => (
              <Field
                key={f.name}
                label={f.label}
                required={'required' in f && f.required}
                error={errors[f.name]?.message}
                className={f.name === 'hospital_name' || f.name === 'address' ? 'sm:col-span-2' : undefined}
              >
                <Input {...register(f.name)} maxLength={f.max} mono={f.name === 'rtn'} autoComplete="off" />
              </Field>
            ))}
            {rtnChanged && (
              <Field label="Motivo del cambio de RTN" required error={errors.reason?.message} className="anim-fade-in sm:col-span-2">
                <Textarea {...register('reason')} rows={2} maxLength={500} />
              </Field>
            )}
            <Field label="Texto al pie" error={errors.receipt_footer_text?.message} className="sm:col-span-2">
              <Textarea {...register('receipt_footer_text')} rows={3} maxLength={2000} />
            </Field>
          </fieldset>
          <FormAlert message={formError} />
          {canEdit && (
            <div className="flex justify-end">
              <Button type="submit" variant="primary" loading={save.isPending} disabled={!isDirty}>
                Guardar cambios
              </Button>
            </div>
          )}
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        <Card title="Vista previa" description="Encabezado del recibo institucional.">
          <ReceiptHeaderPreview v={watched} logoSrc={logoSrc} />
        </Card>
        <Card title="Logo" description="PNG o JPEG, máximo 2 MB.">
          <div className="flex items-center gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-line bg-surface-2">
              {logoSrc ? <img src={logoSrc} alt="Logo actual" className="size-full object-contain" /> : <span className="text-[11px] text-ink-3">Sin logo</span>}
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  aria-label="Archivo de logo"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                      toast.error('El logo supera 2 MB.');
                      return;
                    }
                    uploadLogo.mutate(file);
                  }}
                />
                <Button size="sm" leftIcon={<ImageUp />} loading={uploadLogo.isPending} onClick={() => fileRef.current?.click()}>
                  {s?.has_logo ? 'Cambiar logo' : 'Subir logo'}
                </Button>
                {s?.has_logo && (
                  <Button size="sm" variant="ghost" leftIcon={<Trash2 />} loading={removeLogo.isPending} onClick={() => removeLogo.mutate()}>
                    Quitar
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
