import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { CashRegister } from '@/lib/api/types';
import { AdminCallout, AdminField, AdminPanel, AdminPanelHeader } from '@/design-system/admin/components';
import { parseCents } from '@/lib/moneyCents';
import { INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../cashUi';

const openSessionSchema = z.object({
  opening_amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Debe ser un número válido').refine((value) => (parseCents(value) ?? 0) >= 0, 'El monto no puede ser negativo'),
  cash_register_id: z.string().trim().regex(/^\d+$/, 'Seleccione una caja física.'),
});
type OpenSessionFormData = z.infer<typeof openSessionSchema>;
interface OpenSessionFormProps {
  cashRegisters: CashRegister[];
  cashRegistersError?: string;
  cashRegistersLoading?: boolean;
  isSubmitting: boolean;
  onRetryCashRegisters?: () => void;
  onSubmit: (data: { opening_amount: string; cash_register_id: number }) => void;
}

/**
 * Apertura breve: un solo dato obligatorio (el efectivo inicial) y su
 * confirmación auditada. Sin párrafos técnicos permanentes; la aclaración vive
 * como ayuda del propio campo.
 */
export function OpenSessionForm({
  cashRegisters,
  cashRegistersError = '',
  cashRegistersLoading = false,
  isSubmitting,
  onRetryCashRegisters,
  onSubmit,
}: OpenSessionFormProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<OpenSessionFormData>({
    resolver: zodResolver(openSessionSchema),
    defaultValues: { opening_amount: '0.00', cash_register_id: '' },
  });
  const registration = register('opening_amount');
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (cashRegisters.length === 1) {
      setValue('cash_register_id', String(cashRegisters[0].id), { shouldValidate: true });
    }
  }, [cashRegisters, setValue]);

  const unavailable = cashRegistersLoading || Boolean(cashRegistersError) || cashRegisters.length === 0;

  return (
    <AdminPanel className="w-full max-w-2xl" aria-labelledby="cash-open-title">
      <AdminPanelHeader
        id="cash-open-title"
        title="Apertura de caja"
        description="Registre el efectivo real disponible al iniciar el turno. Puede ser L 0.00."
      />
      <form
        onSubmit={handleSubmit((data) => {
          const registerId = Number(data.cash_register_id);
          if (unavailable || !cashRegisters.some((cashRegister) => cashRegister.id === registerId && cashRegister.active)) {
            setError('cash_register_id', { type: 'validate', message: 'Seleccione una caja habilitada de la lista actual.' }, { shouldFocus: true });
            return;
          }
          onSubmit({ opening_amount: data.opening_amount, cash_register_id: registerId });
        })}
        className="grid gap-4 px-4 py-4 sm:px-5"
        aria-busy={isSubmitting || cashRegistersLoading}
      >
        {cashRegistersLoading ? (
          <p role="status" className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            Consultando cajas habilitadas…
          </p>
        ) : cashRegistersError ? (
          <AdminCallout tone="error" title="No se pudieron consultar las cajas">
            <div className="flex flex-wrap items-center gap-2">
              <span>{cashRegistersError}</span>
              {onRetryCashRegisters ? (
                <button type="button" className={SECONDARY_BUTTON} onClick={onRetryCashRegisters}>
                  Reintentar
                </button>
              ) : null}
            </div>
          </AdminCallout>
        ) : cashRegisters.length === 0 ? (
          <AdminCallout tone="warn" title="No hay cajas habilitadas">
            Un administrador debe habilitar una caja física antes de iniciar el turno.
          </AdminCallout>
        ) : (
          <AdminField
            htmlFor="cash_register_id"
            label="Caja física"
            required
            error={errors.cash_register_id?.message}
            hint={cashRegisters.length === 1 ? 'Caja habilitada para este puesto.' : 'Seleccione la gaveta donde se registrará el turno.'}
          >
            <select
              id="cash_register_id"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.cash_register_id)}
              className={INPUT_CLASS}
              {...register('cash_register_id')}
            >
              {cashRegisters.length > 1 ? <option value="">Seleccione una caja</option> : null}
              {cashRegisters.map((cashRegister) => (
                <option key={cashRegister.id} value={cashRegister.id}>
                  {cashRegister.name}
                </option>
              ))}
            </select>
          </AdminField>
        )}

        <AdminField
          htmlFor="opening_amount"
          label="Monto inicial (L.)"
          required
          error={errors.opening_amount?.message}
          hint="Efectivo que ya está en la gaveta antes del primer cobro."
        >
          <input
            id="opening_amount"
            type="text"
            inputMode="decimal"
            defaultValue="0.00"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.opening_amount)}
            className={`${INPUT_CLASS} h-[var(--ui-control-h-operational)] text-[length:var(--ui-text-lg)] font-semibold tabular-nums`}
            {...registration}
            ref={(element) => { registration.ref(element); inputRef.current = element; }}
          />
        </AdminField>
        <div className="flex justify-end">
          <button type="submit" data-ui-press className={`${PRIMARY_BUTTON} min-w-40`} disabled={isSubmitting || unavailable}>
            {isSubmitting ? 'Abriendo...' : 'Abrir caja'}
          </button>
        </div>
      </form>
    </AdminPanel>
  );
}
