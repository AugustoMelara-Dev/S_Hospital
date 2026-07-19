import type { ReactNode } from 'react';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export type BillingAccountDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function BillingAccountDrawer({ open, onClose, children }: BillingAccountDrawerProps) {
  return (
    <Sheet
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}
    >
      <SheetContent side="right" className="billing-account-drawer w-full gap-0 sm:max-w-lg" showCloseButton={false}>
        <SheetHeader className="flex-row items-start justify-between border-b border-border">
          <div>
            <SheetTitle>Cuenta actual</SheetTitle>
            <SheetDescription>Servicios e importe de la factura en curso.</SheetDescription>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} aria-label="Cerrar cuenta">
            <XIcon aria-hidden="true" /> Cerrar
          </Button>
        </SheetHeader>
        <div data-billing-region="ticket" className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
