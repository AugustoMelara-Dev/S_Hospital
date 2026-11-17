import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage, isApiError } from '@/lib/api';

/**
 * Small helpers shared by the admin features (catálogo, usuarios, ajustes).
 * Kept here (feature scope) instead of src/lib on purpose.
 */

export const REASON_MIN = 5;
export const REASON_MESSAGE = `Escriba un motivo de al menos ${REASON_MIN} caracteres.`;

/** Motivo (SPEC §5.10): ≥5 caracteres útiles. */
export const reasonSchema = z.string().trim().min(REASON_MIN, REASON_MESSAGE).max(500, 'Máximo 500 caracteres.');

/** Lists may come as a bare array or inside the SPEC list envelope. */
export function asList<T>(data: T[] | { items: T[] } | null | undefined): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : (data.items ?? []);
}

/**
 * Copies `ApiError.fields` into RHF errors. `alias` maps server field names
 * to form field names (e.g. `reason` → `price_change_reason`). Returns the
 * general message when no field could be mapped (show it as a form error).
 */
export function applyServerErrors<T extends FieldValues>(
  e: unknown,
  setError: UseFormSetError<T>,
  known: readonly string[],
  alias: Record<string, string> = {},
): string | null {
  if (!isApiError(e)) return errorMessage(e);
  let mapped = 0;
  for (const [field, message] of Object.entries(e.fields)) {
    const target = alias[field] ?? field;
    if (known.includes(target)) {
      setError(target as Path<T>, { type: 'server', message });
      mapped += 1;
    }
  }
  return mapped > 0 && Object.keys(e.fields).length === mapped ? null : e.message;
}

export function FormAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {message}
    </p>
  );
}
