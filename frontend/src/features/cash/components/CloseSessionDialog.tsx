import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { finiteNumber, formatLempirasUI } from '@/lib/money';
import { cn } from '@/lib/utils';

interface AlertDialogContentProps {
  children: ReactNode;
  className?: string;
}

export function AlertDialogContent({ children, className }: AlertDialogContentProps) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/50" />
      <AlertDialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-card p-5 text-card-foreground shadow-lg',
          className,
        )}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

interface AlertDialogHeaderProps {
  children: ReactNode;
}

export function AlertDialogHeader({ children }: AlertDialogHeaderProps) {
  return <div className="flex flex-col gap-1">{children}</div>;
}

interface AlertDialogTitleProps {
  children: ReactNode;
}

export function AlertDialogTitle({ children }: AlertDialogTitleProps) {
  return (
    <AlertDialogPrimitive.Title className="text-lg font-semibold">
      {children}
    </AlertDialogPrimitive.Title>
  );
}

interface AlertDialogDescriptionProps {
  children: ReactNode;
}

export function AlertDialogDescription({ children }: AlertDialogDescriptionProps) {
  return (
    <AlertDialogPrimitive.Description asChild>
      <div className="text-sm text-muted-foreground">
        {children}
      </div>
    </AlertDialogPrimitive.Description>
  );
}

interface AlertDialogFooterProps {
  children: ReactNode;
  className?: string;
}

export function AlertDialogFooter({ children, className }: AlertDialogFooterProps) {
  return <div className={cn('flex flex-wrap justify-end gap-2', className)}>{children}</div>;
}

interface AlertDialogCancelProps {
  children: ReactNode;
  onClick?: () => void;
}

export function AlertDialogCancel({ children, onClick }: AlertDialogCancelProps) {
  return (
    <AlertDialogPrimitive.Cancel asChild>
      <Button type="button" variant="secondary" onClick={onClick}>
        {children}
      </Button>
    </AlertDialogPrimitive.Cancel>
  );
}

interface AlertDialogActionProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function AlertDialogAction({ children, onClick, disabled }: AlertDialogActionProps) {
  return (
    <AlertDialogPrimitive.Action asChild>
      <Button type="button" variant="default" onClick={onClick} disabled={disabled}>
        {children}
      </Button>
    </AlertDialogPrimitive.Action>
  );
}

interface CloseSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: {
    opening_amount: string;
    expected_cash_amount?: string | null;
    expected_amount?: string | null;
    payments_by_method?: { cash: string; transfer: string; card: string; other: string };
    pending_invoice_count?: number;
    pending_amount?: string | null;
  };
  closingAmount: string;
  closingNotes: string;
  difference: number;
  isSubmitting: boolean;
  onClosingNotesChange: (value: string) => void;
  onConfirm: () => void;
}

export function CloseSessionDialog({
  open,
  onOpenChange,
  session,
  closingAmount,
  closingNotes,
  difference,
  isSubmitting,
  onClosingNotesChange,
  onConfirm,
}: CloseSessionDialogProps) {
  const closingNotesRef = useRef<HTMLTextAreaElement | null>(null);
  const openingAmount = finiteNumber(session.opening_amount);
  const expectedAmount = finiteNumber(session.expected_cash_amount ?? session.expected_amount);
  const pendingAmount = finiteNumber(session.pending_amount);
  const pendingInvoiceCount = session.pending_invoice_count ?? 0;
  const isDifference = difference !== 0;
  const methods = session.payments_by_method ?? {
    cash: '0.00',
    transfer: '0.00',
    card: '0.00',
    other: '0.00',
  };

  useEffect(() => {
    if (open && isDifference) {
      window.setTimeout(() => closingNotesRef.current?.focus(), 0);
    }
  }, [isDifference, open]);

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cerrar caja?</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="mt-3 grid gap-3">
              <h3 className="text-xs font-semibold text-foreground">
                1. Resumen del turno
              </h3>
              <div className="rounded-md border border-border bg-muted/35 p-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span>Monto apertura:</span>
                  <strong>{formatLempirasUI(openingAmount)}</strong>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span>Efectivo esperado:</span>
                  <strong>{formatLempirasUI(expectedAmount)}</strong>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 text-xs sm:grid-cols-2">
                <div className="flex justify-between gap-2">
                  <span>Efectivo</span>
                  <strong>{formatLempirasUI(methods.cash)}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Transferencia</span>
                  <strong>{formatLempirasUI(methods.transfer)}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Tarjeta</span>
                  <strong>{formatLempirasUI(methods.card)}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Otros</span>
                  <strong>{formatLempirasUI(methods.other)}</strong>
                </div>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span>Saldo pendiente:</span>
                <strong>{formatLempirasUI(pendingAmount)}</strong>
              </div>
              {pendingInvoiceCount > 0 && (
                <div className="rounded-md border border-warning/35 bg-warning/10 p-3 text-xs font-medium text-warning-foreground">
                  Hay {pendingInvoiceCount} factura(s) pendientes o parciales. El servidor no permitira cerrar hasta revisarlas.
                </div>
              )}
              <h3 className="text-xs font-semibold text-foreground">
                2. Conteo de efectivo
              </h3>
              <div className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <span>Contado:</span>
                  <strong>{formatLempirasUI(closingAmount || '0.00')}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Diferencia:</span>
                  <strong className={cn(isDifference ? 'text-destructive' : 'text-success-foreground')}>
                    {formatLempirasUI(difference)}
                  </strong>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isDifference && (
          <div className="mt-4 space-y-2">
            <label className="text-sm font-semibold" htmlFor="closing_difference_notes">
              Nota sobre la diferencia *
            </label>
            <Textarea
              ref={closingNotesRef}
              id="closing_difference_notes"
              value={closingNotes}
              onChange={(e) => onClosingNotesChange(e.target.value)}
              placeholder="Explique la diferencia..."
              rows={2}
              aria-invalid={isDifference && !closingNotes.trim()}
              aria-describedby={isDifference && !closingNotes.trim() ? 'closing-notes-error' : undefined}
            />
          </div>
        )}

        <section className="mt-5 grid gap-2" aria-labelledby="close-session-confirm-step">
          <h3 id="close-session-confirm-step" className="text-xs font-semibold text-foreground">
            3. Confirmar cierre
          </h3>
          <p className="text-sm text-muted-foreground">
            Confirme solo despues de revisar el resumen, el conteo fisico y la diferencia calculada.
          </p>
        </section>

        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSubmitting || (isDifference && !closingNotes.trim())}>
            {isSubmitting ? 'Cerrando...' : 'Cerrar caja'}
          </AlertDialogAction>
        </AlertDialogFooter>

        {isDifference && !closingNotes.trim() && (
          <div id="closing-notes-error" role="alert" className="mt-2 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>La nota es obligatoria cuando hay diferencia.</span>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialogPrimitive.Root>
  );
}
