import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './base';
import { cash } from './cash';

vi.mock('./base', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

const mockedRequest = vi.mocked(apiClient.request);

describe('cash api client', () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it('maps a missing current cash session payload to null', async () => {
    mockedRequest.mockResolvedValueOnce({});

    await expect(cash.getCurrentCashSession()).resolves.toBeNull();

    expect(mockedRequest).toHaveBeenCalledWith('/api/cash-sessions/current');
  });
});
