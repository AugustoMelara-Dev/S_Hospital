import type { Page } from '@playwright/test';
import type { AdminTestCashSession } from './admin-e2e';

type Option = { value: string; label: string };
type Session = AdminTestCashSession & { cash_register_id?: number; cash_register?: { id: number; name: string; code?: string } };

/** Contract fixture, restricted to the authorized synthetic sessions supplied
 * by its caller. Search/pagination never fetch another endpoint or real data. */
export function cashOptionsResponse(url: URL, sessions: Session[]) {
  const kind = url.searchParams.get('kind');
  if (!['sessions', 'cashiers', 'registers'].includes(kind ?? '')) throw new Error('Unknown cash option kind');
  const page = Number(url.searchParams.get('page') ?? 1);
  const perPage = Number(url.searchParams.get('per_page') ?? 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(perPage) || perPage < 1 || perPage > 50) throw new Error('Invalid cash option pagination');
  const entries = new Map<string, Option>();
  for (const session of sessions) {
    const registerId = session.cash_register?.id ?? session.cash_register_id ?? 1;
    const registerName = session.cash_register?.name ?? 'Caja principal';
    const cashier = session.user?.name ?? 'Cajero sin nombre registrado';
    const option = kind === 'cashiers'
      ? { value: String(session.user_id), label: cashier }
      : kind === 'registers'
        ? { value: String(registerId), label: registerName }
        : { value: String(session.id), label: `${registerName} · ${cashier} · ${session.opened_at.slice(0, 16).replace('T', ' ')} · Turno ${session.id}` };
    entries.set(option.value, option);
  }
  const all = [...entries.values()];
  const search = (url.searchParams.get('search') ?? '').trim().toLocaleLowerCase('es');
  const matching = all.filter((option) => !search || option.label.toLocaleLowerCase('es').includes(search) || option.value === search);
  const selectedId = url.searchParams.get('selected_id');
  return {
    data: matching.slice((page - 1) * perPage, page * perPage),
    meta: { current_page: page, per_page: perPage, total: matching.length },
    selected: selectedId ? all.find((option) => option.value === selectedId) ?? null : null,
  };
}

export async function installCashSessionOptions(page: Page, sessions: () => Session[]) {
  await page.route(/\/api\/cash-sessions\/options(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    try {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cashOptionsResponse(new URL(route.request().url()), sessions())) });
    } catch (error) {
      return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: error instanceof Error ? error.message : 'Invalid options request' }) });
    }
  });
}
