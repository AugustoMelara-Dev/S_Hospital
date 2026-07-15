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

  it('forwards cancellation and all billing search filters', async () => {
    const controller = new AbortController();
    mockedRequest.mockResolvedValueOnce({
      data: [],
      meta: { current_page: 2, per_page: 24, total: 0 },
    });

    await catalog.getServicesPage({
      active: true,
      billing: true,
      search: 'glucosa',
      code: 'LAB-GLU',
      categoryId: 3,
      areaId: 4,
      page: 2,
      perPage: 24,
    }, { signal: controller.signal });

    expect(mockedRequest).toHaveBeenCalledWith(
      '/api/services?search=glucosa&code=LAB-GLU&active=1&billing=1&visible_in_billing=1&is_billable=1&category_id=3&area_id=4&page=2&per_page=24',
      { signal: controller.signal },
    );
  });
});
