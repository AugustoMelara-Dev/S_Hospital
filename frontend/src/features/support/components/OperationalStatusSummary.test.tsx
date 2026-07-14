import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SystemStatus, SystemStatusSummary } from '../../../lib/api';
import { OperationalStatusSummary } from './OperationalStatusSummary';

describe('OperationalStatusSummary', () => {
  it('uses one support surface without nesting metric cards inside the summary card', () => {
    const summary = {
      summary: { severity: 'ok', problem_count: 0, label: 'Todo bien', action: 'Continúe operando.' },
      checks: [],
      advanced_available: true,
    } satisfies SystemStatusSummary;
    const status = {
      backups: { last_success_at: null },
      database: { is_mysql_family: true },
      environment: { server_time: '2026-07-14T10:00:00-06:00' },
    } as unknown as SystemStatus;

    const { container } = render(
      <OperationalStatusSummary
        loading={false}
        summary={summary}
        status={status}
        canViewAdvanced
        onRefresh={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('.ant-card .ant-card')).toHaveLength(0);
  });
});
