import type { Service } from '@/api/types';

/** One line of the account being built in Cobrar (prices come from the preview, not from here). */
export type CartLine = {
  service: Pick<Service, 'id' | 'name' | 'price_cents' | 'special_rule_code'> & {
    category?: { id: number; name: string } | null;
  };
  quantity_hundredths: number;
};

export type QuickService = CartLine['service'];
