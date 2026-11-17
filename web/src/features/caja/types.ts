import type { CashSession } from '@/api/types';

export type CashSessionsQuery = {
  date_from?: string;
  date_to?: string;
  cash_register_id?: string;
  user_id?: string;
  difference?: 'all' | 'balanced' | 'shortage' | 'overage';
  page: number;
};

export function operatorName(s: Pick<CashSession, 'user'>): string {
  return s.user.name;
}

export function registerName(s: Pick<CashSession, 'cash_register'>): string {
  return s.cash_register.name;
}
