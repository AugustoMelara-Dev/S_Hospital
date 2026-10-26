import { describe, expect, it } from 'vitest';
import { cashOptionsResponse } from '../../e2e/fixtures/cash-options';
import { openCashSessionFixture } from '../../e2e/fixtures/admin-e2e';

describe('strict cash options fixture contract', () => {
  const sessions = Array.from({ length: 61 }, (_, index) => openCashSessionFixture({ id: index + 1, user_id: index % 2 + 10, user: { id: index % 2 + 10, name: index % 2 ? 'Cajera Ana' : 'Cajero Luis', username: 'not-in-response' } }));
  it('paginates beyond 50 without losing the authorized selection outside search results', () => {
    const page = cashOptionsResponse(new URL('http://qa/api/cash-sessions/options?kind=sessions&page=3&per_page=20&selected_id=1'), sessions);
    expect(page.data).toHaveLength(20);
    expect(page.data[0].value).toBe('41');
    expect(page.meta).toEqual({ current_page: 3, per_page: 20, total: 61 });
    expect(page.selected?.value).toBe('1');
    const search = cashOptionsResponse(new URL('http://qa/api/cash-sessions/options?kind=sessions&search=Ana&selected_id=1'), sessions);
    expect(search.data.every((option) => option.label.includes('Ana'))).toBe(true);
    expect(search.selected?.value).toBe('1');
  });
  it('returns distinct cashiers and registers rather than repeating sessions', () => {
    expect(cashOptionsResponse(new URL('http://qa/api/cash-sessions/options?kind=cashiers'), sessions).data).toHaveLength(2);
    expect(cashOptionsResponse(new URL('http://qa/api/cash-sessions/options?kind=registers'), sessions).data).toHaveLength(1);
    expect(JSON.stringify(cashOptionsResponse(new URL('http://qa/api/cash-sessions/options?kind=cashiers'), sessions))).not.toContain('not-in-response');
  });
  it('rejects unsupported kinds and unbounded pages instead of inventing success', () => {
    expect(() => cashOptionsResponse(new URL('http://qa/api/cash-sessions/options?kind=unknown'), sessions)).toThrow();
    expect(() => cashOptionsResponse(new URL('http://qa/api/cash-sessions/options?kind=sessions&per_page=999'), sessions)).toThrow();
    expect(cashOptionsResponse(new URL('http://qa/api/cash-sessions/options?kind=sessions&selected_id=999'), sessions).selected).toBeNull();
  });
});
