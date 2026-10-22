import type { Service } from './api';
import { parseCents } from './moneyCents';

export type ServiceBillingBadge = {
  label: string;
  tone: 'default' | 'secondary' | 'outline' | 'destructive' | 'warning';
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

const ERYTHROPOIETIN_DIALYSIS_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

export function getServiceBillingSummary(service: Service): ServiceBillingSummary {
  const isActive = service.active !== false;
  const isVisibleInBilling = service.visible_in_billing !== false;
  const isBillable = service.is_billable !== false;
  const priceCents = parseCents(service.price);
  const hasConfiguredPrice = priceCents !== null && priceCents > 0;

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

  if (service.special_rule_code === ERYTHROPOIETIN_DIALYSIS_RULE) {
    reasons.push('Gratis con receta de diálisis autorizada; sin receta se cobra la tarifa vigente del catálogo.');
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
    // R2-FE-STRUCT S6: solo se etiquetan las EXCEPCIONES. Los valores por
    // defecto (activo, visible en facturación, facturable, tarifa
    // configurada) no generan ruido repetido; el estado activo se muestra
    // como token textual propio (no como badge).
    badges: [
      ...(!isActive ? [{ label: 'Inactivo', tone: 'warning' as const }] : []),
      ...(!isVisibleInBilling ? [{ label: 'Oculto en facturación', tone: 'warning' as const }] : []),
      ...(!isBillable ? [{ label: 'No facturable', tone: 'destructive' as const }] : []),
      ...(!hasConfiguredPrice ? [{ label: 'Sin tarifa', tone: 'warning' as const }] : []),
      ...(service.special_rule_code === ERYTHROPOIETIN_DIALYSIS_RULE
        ? [{
            label: 'Receta diálisis',
            tone: 'outline' as const,
          }]
        : []),
    ],
    reasons,
  };
}
