import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AlertDialogContentProps {
  children: ReactNode;
  className?: string;
}

export function AlertDialogContent({ children, className }: AlertDialogContentProps) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
      <AlertDialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-lg',
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
    <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
      {children}
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
  session: { opening_amount: string; expected_cash_amount?: string | null; expected_amount?: string | null };
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
  const openingAmount = parseFloat(session.opening_amount || '0');
  const expectedAmount = parseFloat(session.expected_cash_amount ?? session.expected_amount ?? '0');
  const isDifference = difference !== 0;

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cerrar caja?</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between">
                <span>Monto apertura:</span>
                <strong>L. {openingAmount.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Total esperado:</span>
                <strong>L. {expectedAmount.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Contado:</span>
                <strong>L. {closingAmount || '0.00'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Diferencia:</span>
                <strong className={cn(isDifference ? 'text-destructive' : 'text-emerald-600')}>
                  L. {difference.toFixed(2)}
                </strong>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isDifference && (
          <div className="mt-4 space-y-2">
            <label className="text-sm font-semibold" htmlFor="closing_notes">
              Nota sobre la diferencia *
            </label>
            <textarea
              id="closing_notes"
              value={closingNotes}
              onChange={(e) => onClosingNotesChange(e.target.value)}
              placeholder="Explique la diferencia..."
              rows={2}
              className="flex min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        )}

        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSubmitting || (isDifference && !closingNotes.trim())}>
            {isSubmitting ? 'Cerrando...' : 'Cerrar Caja'}
          </AlertDialogAction>
        </AlertDialogFooter>

        {isDifference && !closingNotes.trim() && (
          <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>La nota es obligatoria cuando hay diferencia.</span>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialogPrimitive.Root>
  );
}
