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
    reasons.push('No puede facturarse porque está inactivo.');
  }

  if (!isVisibleInBilling) {
    reasons.push('No aparece en Nueva factura porque está oculto en facturación.');
  }

  if (!isBillable) {
    reasons.push('No puede agregarse al carrito porque está marcado como no facturable.');
  }

  if (!hasConfiguredPrice) {
    reasons.push('Revise la tarifa antes de usar este servicio en caja.');
  }

  const blockReason = !isActive
    ? 'El servicio seleccionado está inactivo.'
    : !isVisibleInBilling
      ? 'El servicio seleccionado está oculto en facturación.'
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
        label: isVisibleInBilling ? 'Visible en facturación' : 'Oculto en facturación',
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
