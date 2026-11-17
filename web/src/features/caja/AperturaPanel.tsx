import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, LockOpen } from 'lucide-react';
import { api, errorMessage, isApiError, newIdempotencyKey } from '@/lib/api';
import { qk } from '@/api/queryClient';
import { usePermissions } from '@/auth/hooks';
import { Button, Card, EmptyState, Field, Kbd, MoneyInput, Select, Skeleton, Textarea, toast } from '@/ui';
import { invalidateCash, useCashRegisters } from './queries';
import type { CashSessionRow } from './types';

/** "Apertura de caja" (no session yet). Users without cash.open see the read-only notice. */
export function AperturaPanel() {
  const { can } = usePermissions();
  if (!can('cash.open')) {
    return (
      <Card>
        <EmptyState
          icon={<Eye />}
          title="Caja en modo consulta"
          description="No tiene una caja abierta y su usuario no puede abrir caja. Puede revisar el histórico de caja."
        />
      </Card>
    );
  }
  return <AperturaForm />;
}

function AperturaForm() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const registers = useCashRegisters();
  const [registerId, setRegisterId] = useState<string>('');
  const [amount, setAmount] = useState<number | null>(0);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  // One key per opening attempt; reused if the user retries after a network error.
  const keyRef = useRef<string>(newIdempotencyKey());
  const lastBody = useRef<string>('');

  const list = registers.data ?? [];
  const selected = registerId || (list.length === 1 && list[0] ? String(list[0].id) : '');

  // F2 focuses the amount here only when the global F2 (new operation) is not active for this user.
  const f2Free = !can('invoices.create');
  useEffect(() => {
    if (!f2Free) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault();
        amountRef.current?.focus();
        amountRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [f2Free]);

  const amountError = submitted && amount === null ? 'Ingrese el monto inicial (puede ser L 0.00).' : null;
  const registerError = submitted && list.length > 1 && !selected ? 'Seleccione la caja física.' : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (amount === null || (list.length > 1 && !selected)) return;
    const body = {
      ...(selected ? { cash_register_id: Number(selected) } : {}),
      opening_cents: amount,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    const fingerprint = JSON.stringify(body);
    if (fingerprint !== lastBody.current) {
      keyRef.current = newIdempotencyKey();
      lastBody.current = fingerprint;
    }
    setBusy(true);
    try {
      const session = await api.post<CashSessionRow>('/cash-sessions/open', body, { idempotencyKey: keyRef.current });
      qc.setQueryData(qk.currentCash, session);
      toast.success('Caja abierta.');
      keyRef.current = newIdempotencyKey();
      lastBody.current = '';
      void invalidateCash(qc);
    } catch (err) {
      setError(errorMessage(err));
      if (isApiError(err) && err.status === 409) void invalidateCash(qc);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Apertura de caja"
      description="Registre el efectivo con el que inicia el turno."
      className="max-w-[560px]"
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        <Field label="Caja física" required error={registerError}>
          {registers.isPending ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select
              value={selected}
              onChange={(e) => setRegisterId(e.target.value)}
              placeholder={list.length > 1 ? 'Seleccione…' : undefined}
              options={list.map((r) => ({ value: String(r.id), label: r.name }))}
              disabled={list.length === 0}
            />
          )}
        </Field>
        <Field
          label="Monto inicial (L)"
          required
          hint={
            <>
              Puede ser L 0.00.{f2Free && <> Atajo: <Kbd>F2</Kbd></>}
            </>
          }
          error={amountError}
        >
          <MoneyInput ref={amountRef} value={amount} onValueChange={setAmount} autoFocus />
        </Field>
        <Field label="Nota de apertura" hint="Opcional.">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={255} />
        </Field>
        {error && (
          <p role="alert" className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={busy} leftIcon={<LockOpen />}>
            Abrir caja
          </Button>
        </div>
      </form>
    </Card>
  );
}
