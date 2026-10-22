import type { InvoicePayload, Service } from '@/lib/api';
import { parseCents, parseQuantityUnits, type Cents } from '@/lib/moneyCents';
import { normalizePatientName } from '../cobrarSchema';
import type { CobrarLine } from './types';

/**
 * Regla crítica: la gratuidad por receta/diálisis es EXCLUSIVA del medicamento
 * elegible y se evalúa por línea. Un booleano raíz jamás descuenta la factura.
 */
export const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

export function isEligibleMedication(service: Pick<Service, 'special_rule_code'>): boolean {
  return service.special_rule_code === ERYTHROPOIETIN_RULE;
}

/** Una línea es gratuita solo si es medicamento elegible y la condición aplica. */
export function lineIsFree(line: CobrarLine): boolean {
  return line.dialysisPrescription === true && isEligibleMedication(line.service);
}

/**
 * Importe local de la línea, en centavos. Un precio/cantidad mal formados
 * devuelven `null` (nunca un cero falso). La línea gratuita devuelve 0 legítimo.
 */
export function lineTotalCents(line: CobrarLine): Cents | null {
  if (lineIsFree(line)) {
    return 0 as Cents;
  }

  const price = parseCents(line.service.price);
  const units = parseQuantityUnits(line.quantity);

  if (price === null || units === null) {
    return null;
  }

  return Math.trunc((price * units + 50) / 100) as Cents;
}

export function cartSubtotalCents(lines: CobrarLine[]): Cents | null {
  let subtotal = 0;

  for (const line of lines) {
    const total = lineTotalCents(line);

    if (total === null) {
      return null;
    }

    subtotal += total;
  }

  return subtotal as Cents;
}

export function hasEligibleMedication(lines: CobrarLine[]): boolean {
  return lines.some((line) => isEligibleMedication(line.service));
}

/** Condición activa = al menos una línea elegible marcada. */
export function conditionActive(lines: CobrarLine[]): boolean {
  return lines.some(lineIsFree);
}

/**
 * Marca/desmarca la condición SOLO sobre líneas elegibles. Ningún otro
 * producto o servicio (ni el servicio de diálisis cobrable) se altera.
 */
export function toggleCondition(lines: CobrarLine[], checked: boolean): CobrarLine[] {
  return lines.map((line) =>
    isEligibleMedication(line.service) ? { ...line, dialysisPrescription: checked } : line,
  );
}

export function addOrIncrementLine(lines: CobrarLine[], service: Service): CobrarLine[] {
  const existing = lines.find((line) => line.service.id === service.id);

  if (!existing) {
    return [...lines, { service, quantity: '1', dialysisPrescription: false }];
  }

  return lines.map((line) => {
    if (line.service.id !== service.id) {
      return line;
    }

    const units = parseQuantityUnits(line.quantity);

    return { ...line, quantity: units === null ? line.quantity : String((units + 100) / 100) };
  });
}

export function updateLineQuantity(lines: CobrarLine[], index: number, quantity: string): CobrarLine[] {
  return lines.map((line, current) => (current === index ? { ...line, quantity } : line));
}

export function removeLine(lines: CobrarLine[], index: number): CobrarLine[] {
  return lines.filter((_, current) => current !== index);
}

/**
 * Payload de emisión. `dialysis_prescription` solo viaja en `true` cuando el
 * permiso está presente Y hay una línea elegible marcada; una condición activa
 * sin elegible nunca concede gratuidad.
 */
export function buildCobrarPayload({
  lines,
  patientName,
  canMarkDialysisPrescription,
}: {
  lines: CobrarLine[];
  patientName: string;
  canMarkDialysisPrescription: boolean;
}): InvoicePayload {
  const prescription = canMarkDialysisPrescription
    && lines.some((line) => line.dialysisPrescription && isEligibleMedication(line.service));

  return {
    patient_name: normalizePatientName(patientName),
    ...(prescription ? { dialysis_prescription: true } : {}),
    items: lines.map((line) => ({ service_id: line.service.id, quantity: line.quantity })),
  };
}

/**
 * Firma de la revisión: paciente, líneas, cantidades y condición. Cualquier
 * cambio invalida la valoración y bloquea confirmar una versión vieja.
 */
export function cartSignature(lines: CobrarLine[], patientName: string): string {
  return JSON.stringify({
    patient: normalizePatientName(patientName),
    lines: lines.map((line) => [line.service.id, line.quantity, line.dialysisPrescription]),
  });
}

/** Hash entero estable de la firma para la guarda de revisión. */
export function signatureHash(signature: string): number {
  let hash = 0;

  for (let index = 0; index < signature.length; index += 1) {
    hash = (hash * 31 + signature.charCodeAt(index)) | 0;
  }

  return hash;
}
