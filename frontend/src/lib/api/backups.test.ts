import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './base';
import { backups } from './backups';

vi.mock('./base', () => ({
  apiClient: {
    request: vi.fn(),
    url: vi.fn((path: string) => `http://hospital.local${path}`),
    download: vi.fn(),
  },
}));

const mockedRequest = vi.mocked(apiClient.request);

describe('backups api client', () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it('allows manual backup creation with a caller-managed idempotency key', async () => {
    mockedRequest.mockResolvedValueOnce({
      data: {
        id: 99,
        size_bytes: 0,
        status: 'pending',
        type: 'manual',
        created_by: 1,
        completed_at: null,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
        checksum_sha256: null,
      },
    });

    await expect(backups.createBackup({
      idempotencyKey: 'manual-backup-attempt-1',
    })).resolves.toMatchObject({
      id: 99,
      status: 'pending',
    });

    expect(mockedRequest).toHaveBeenCalledWith('/api/backups', {
      method: 'POST',
      idempotencyKey: 'manual-backup-attempt-1',
      headers: { 'Idempotency-Key': 'manual-backup-attempt-1' },
      body: JSON.stringify({}),
    });
  });
});
