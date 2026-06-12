import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { shouldRetryOperationalQuery } from './query-client';

describe('shouldRetryOperationalQuery', () => {
  it('does not retry recoverable operator-visible API errors', () => {
    expect(shouldRetryOperationalQuery(0, new ApiError('Too many requests', 429))).toBe(false);
    expect(shouldRetryOperationalQuery(0, new ApiError('Forbidden', 403))).toBe(false);
    expect(shouldRetryOperationalQuery(0, new ApiError('Session expired', 419))).toBe(false);
    expect(shouldRetryOperationalQuery(0, new ApiError('Invalid data', 422))).toBe(false);
  });

  it('keeps one retry for transient unknown failures', () => {
    expect(shouldRetryOperationalQuery(0, new Error('Network disconnected'))).toBe(true);
    expect(shouldRetryOperationalQuery(1, new Error('Network disconnected'))).toBe(false);
  });
});
