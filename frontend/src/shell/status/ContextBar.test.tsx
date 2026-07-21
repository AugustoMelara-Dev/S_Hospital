import { describe, expect, it } from 'vitest';
import { cashSessionLabel } from './ContextBar';

describe('cashSessionLabel', () => {
  it('makes clear that the header describes the signed-in user cashbox', () => {
    expect(cashSessionLabel(null)).toBe('Mi caja cerrada');
    expect(cashSessionLabel({ id: 27, status: 'open' })).toBe('Mi caja #27');
  });
});
