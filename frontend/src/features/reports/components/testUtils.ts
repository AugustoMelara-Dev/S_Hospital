import type { ExecutiveReport } from '@/lib/api';

export function buildExecutiveReport(overrides: Partial<ExecutiveReport> = {}): ExecutiveReport {
  return {
    period: { from: '2026-06-01', to: '2026-06-02', timezone: 'America/Tegucigalpa', days: 2 },
    filters: {
      cash_session_id: null,
      user_id: null,
      category_id: null,
      area_id: null,
      method: null,
      status: null,
    },
    comparison: {
      billed: { current: '0.00', previous: '0.00', delta_cents: 0, delta_percentage: null },
      collected: { current: '0.00', previous: '0.00', delta_cents: 0, delta_percentage: null },
      previous_period: { from: '2026-05-30', to: '2026-05-31' },
    },
    summary: {
      billed_total: '0.00',
      collected_total: '0.00',
      collected_total_cents: 0,
      pending_total: '0.00',
      voided_total: '0.00',
      reversed_total: '0.00',
      invoice_count: 0,
      receipt_count: 0,
      paid_count: 0,
      partial_count: 0,
      pending_count: 0,
      voided_count: 0,
      average_ticket: '0.00',
    },
    payment_methods: [],
    daily_trend: [],
    services: {
      top_by_amount: [],
      top_by_quantity: [],
      by_category: [],
      by_area: [],
    },
    cashiers: [],
    cash_sessions: [],
    pending_aging: {
      '0_7_days': { count: 0, amount: '0.00' },
      '8_30_days': { count: 0, amount: '0.00' },
      '31_plus_days': { count: 0, amount: '0.00' },
      items: [],
    },
    voids_and_reversals: [],
    audit_summary: {
      critical_events: 0,
      reprints: 0,
      fiscal_changes: 0,
      cash_differences: 0,
      backup_events: 0,
    },
    ...overrides,
  };
}
