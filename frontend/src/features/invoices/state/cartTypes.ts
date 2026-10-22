import type { Service } from '../../../lib/api';

/**
 * Línea de la cuenta del POS.
 *
 * Contrato compartido por el estimado provisional (`posMath`), el estado de
 * facturación y el módulo Cobrar. Vive en un módulo neutral de estado, sin
 * depender de ningún componente de presentación: el antiguo `InvoiceCart` fue
 * retirado y su tipo se reubicó aquí para no arrastrar primitivas R2 muertas
 * a los importadores.
 */
export type CartItem = {
  service: Service;
  quantity: string;
  dialysisPrescription: boolean;
};
