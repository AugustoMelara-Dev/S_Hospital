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

  it('uses valid active query strings for categories and service areas', async () => {
    mockedRequest.mockResolvedValue({ data: [] });

    await catalog.getCategories(true);
    await catalog.getServiceAreas(false);

    expect(mockedRequest).toHaveBeenNthCalledWith(1, '/api/categories?active=1');
    expect(mockedRequest).toHaveBeenNthCalledWith(2, '/api/service-areas?active=0');
  });
});
