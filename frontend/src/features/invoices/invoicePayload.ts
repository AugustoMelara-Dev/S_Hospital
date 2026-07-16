import type { InvoicePayload } from '@/lib/api';
import type { CartItem } from './components/InvoiceCart';

type BuildInvoicePayloadInput = {
  canMarkDialysisPrescription: boolean;
  cartItems: CartItem[];
  patientName: string;
};

const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

export function buildInvoicePayload({
  canMarkDialysisPrescription,
  cartItems,
  patientName,
}: BuildInvoicePayloadInput): InvoicePayload {
  return {
    patient_name: patientName.trim(),
    dialysis_prescription: canMarkDialysisPrescription && cartItems.some(
      (item) => item.dialysisPrescription && item.service.special_rule_code === ERYTHROPOIETIN_RULE,
    ),
    items: cartItems.map((item) => ({
      service_id: item.service.id,
      quantity: item.quantity,
    })),
  };
}
