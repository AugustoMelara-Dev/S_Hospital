import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './base';
import { system } from './system';

vi.mock('./base', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

const mockedRequest = vi.mocked(apiClient.request);

describe('system api client', () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it('lists audit logs with compact query parameters for applied filters', async () => {
    mockedRequest.mockResolvedValueOnce({
      data: [],
      meta: { current_page: 2, per_page: 25, total: 0 },
    });

    await expect(system.getAuditLogs({
      action: 'invoice.void',
      user_id: 7,
      from: '2026-06-01',
      to: '2026-06-30',
      page: 2,
      per_page: 25,
    })).resolves.toEqual({
      data: [],
      meta: { current_page: 2, per_page: 25, total: 0 },
    });

    expect(mockedRequest).toHaveBeenCalledWith(
      '/api/system/audit-logs?action=invoice.void&user_id=7&from=2026-06-01&to=2026-06-30&page=2&per_page=25',
    );

    const requestedPath = mockedRequest.mock.calls[0]?.[0];
    expect(requestedPath).toMatch(/^\/api\/system\/audit-logs\?/);
    expect(requestedPath).not.toMatch(/Ã|áction/);
    const requestedUrl = new URL(requestedPath, 'http://hospital.local');
    expect(Object.fromEntries(requestedUrl.searchParams)).toEqual({
      action: 'invoice.void',
      user_id: '7',
      from: '2026-06-01',
      to: '2026-06-30',
      page: '2',
      per_page: '25',
    });
  });
});
