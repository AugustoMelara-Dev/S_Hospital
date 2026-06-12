import type { Service } from './api';
import { parseCents } from './moneyCents';

export type ServiceBillingBadge = {
  label: string;
  tone: 'default' | 'secondary' | 'outline' | 'destructive';
};

export type ServiceBillingSummary = {
  canAddToInvoice: boolean;
  canAppearInInvoiceSearch: boolean;
  hasConfiguredPrice: boolean;
  warning: string | null;
  blockReason: string | null;
  badges: ServiceBillingBadge[];
  reasons: string[];
};

export function getServiceBillingSummary(service: Service): ServiceBillingSummary {
  const isActive = service.active !== false;
  const isVisibleInBilling = service.visible_in_billing !== false;
  const isBillable = service.is_billable !== false;
  const hasConfiguredPrice = (parseCents(service.price) ?? 0) > 0;

  const reasons: string[] = [];

  if (!isActive) {
    reasons.push('No puede facturarse porque esta inactivo.');
  }

  if (!isVisibleInBilling) {
    reasons.push('No aparece en Nueva factura porque esta oculto en facturacion.');
  }

  if (!isBillable) {
    reasons.push('No puede agregarse al carrito porque esta marcado como no facturable.');
  }

  if (!hasConfiguredPrice) {
    reasons.push('Revise la tarifa antes de usar este servicio en caja.');
  }

  const blockReason = !isActive
    ? 'El servicio seleccionado esta inactivo.'
    : !isVisibleInBilling
      ? 'El servicio seleccionado esta oculto en facturacion.'
      : !isBillable
        ? 'El servicio seleccionado no es facturable.'
        : null;

  const warning = blockReason === null && !hasConfiguredPrice
    ? 'El servicio no tiene tarifa configurada.'
    : null;

  return {
    canAddToInvoice: blockReason === null,
    canAppearInInvoiceSearch: isActive && isVisibleInBilling,
    hasConfiguredPrice,
    warning,
    blockReason,
    badges: [
      {
        label: isActive ? 'Activo' : 'Inactivo',
        tone: isActive ? 'default' : 'outline',
      },
      {
        label: isVisibleInBilling ? 'Visible en facturacion' : 'Oculto en facturacion',
        tone: isVisibleInBilling ? 'secondary' : 'outline',
      },
      {
        label: isBillable ? 'Facturable' : 'No facturable',
        tone: isBillable ? 'secondary' : 'destructive',
      },
      {
        label: hasConfiguredPrice ? 'Tarifa configurada' : 'Sin tarifa',
        tone: hasConfiguredPrice ? 'secondary' : 'outline',
      },
    ],
    reasons,
  };
}
