import type { CashMovement, CashSession, ID } from '@/api/types';

/**
 * Local extensions of the shared cash types (fields the API returns that
 * `src/api/types.ts` does not declare yet).
 */
export type CashMovementRow = CashMovement & {
  invoice_id?: ID | null;
  reference?: string | null;
  user_name?: string | null;
};

export type CashSessionRow = Omit<CashSession, 'movements'> & {
  /** Flat names some list endpoints return instead of nested objects. */
  user_name?: string | null;
  cash_register_name?: string | null;
  closed_by_name?: string | null;
  movements?: CashMovementRow[];
};

export type CashSessionsQuery = {
  date_from?: string;
  date_to?: string;
  cash_register_id?: string;
  user_id?: string;
  difference?: 'all' | 'balanced' | 'shortage' | 'overage';
  page: number;
};

export function operatorName(s: Pick<CashSessionRow, 'user' | 'user_name' | 'user_id'>): string {
  return s.user?.name ?? s.user_name ?? `Usuario #${s.user_id}`;
}

export function registerName(s: Pick<CashSessionRow, 'cash_register' | 'cash_register_name' | 'cash_register_id'>): string {
  return s.cash_register?.name ?? s.cash_register_name ?? `Caja #${s.cash_register_id}`;
}
