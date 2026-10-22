import type { Service } from '@/lib/api';
import { parseCents, type Cents } from '@/lib/moneyCents';

/**
 * Notas operativas del catálogo.
 *
 * El catálogo es la autoridad del precio: ninguna nota de esta superficie
 * escribe un importe a mano. Cuando la regla institucional de eritropoyetina
 * necesita decir cuánto se cobra sin receta, publica el importe **vigente del
 * servicio** (`service.price`) para que la vista lo dibuje con `MoneyText`. Si
 * la tarifa no está configurada, la nota no inventa una cifra: describe la
 * regla y pide revisar la tarifa.
 *
 * `getServiceBillingSummary` (lib) sigue aportando las insignias y el bloqueo
 * de facturación sin duplicar una cifra de tarifa.
 */
export const ERYTHROPOIETIN_DIALYSIS_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

export type ServiceOperationalNote = {
  id: 'inactive' | 'hidden-in-billing' | 'not-billable' | 'dialysis-prescription' | 'missing-price';
  /** Texto operativo sin importes escritos a mano. */
  text: string;
  /** Importe tomado del catálogo vigente; la vista lo dibuja con `MoneyText`. */
  moneyCents?: Cents;
};

export function serviceOperationalNotes(service: Service): ServiceOperationalNote[] {
  const priceCents = parseCents(service.price);
  const hasConfiguredPrice = priceCents !== null && priceCents > 0;
  const notes: ServiceOperationalNote[] = [];

  if (service.active === false) {
    notes.push({ id: 'inactive', text: 'No puede facturarse porque está inactivo.' });
  }

  if (service.visible_in_billing === false) {
    notes.push({
      id: 'hidden-in-billing',
      text: 'No aparece en Nueva factura porque está oculto en facturación.',
    });
  }

  if (service.is_billable === false) {
    notes.push({
      id: 'not-billable',
      text: 'No puede agregarse a la cuenta porque está marcado como no facturable.',
    });
  }

  if (service.special_rule_code === ERYTHROPOIETIN_DIALYSIS_RULE) {
    notes.push(
      hasConfiguredPrice
        ? {
            id: 'dialysis-prescription',
            text: 'Sin cobro con receta de diálisis; sin receta se cobra la tarifa vigente del catálogo:',
            moneyCents: priceCents,
          }
        : {
            id: 'dialysis-prescription',
            text: 'Sin cobro con receta de diálisis; sin receta se cobra la tarifa vigente del catálogo.',
          },
    );
  }

  if (!hasConfiguredPrice) {
    notes.push({ id: 'missing-price', text: 'Revise la tarifa antes de usar este servicio en caja.' });
  }

  return notes;
}
