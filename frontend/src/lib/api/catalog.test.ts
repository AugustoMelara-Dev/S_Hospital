import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './base';
import { catalog } from './catalog';

vi.mock('./base', () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

const mockedRequest = vi.mocked(apiClient.request);

describe('catalog api client', () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it('maps a missing areas payload to an empty list', async () => {
    mockedRequest.mockResolvedValueOnce({});

    await expect(catalog.getAreas(true)).resolves.toEqual([]);

    expect(mockedRequest).toHaveBeenCalledWith('/api/areas?active=1');
  });
});
