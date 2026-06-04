import { describe, expect, it, beforeEach } from 'vitest';
import { getStoredUserId, setStoredUserId } from './session';

describe('realtime session cache', () => {
  beforeEach(() => {
    setStoredUserId(null);
  });

  it('defaults to null when no user is set', () => {
    expect(getStoredUserId()).toBe(null);
  });

  it('stores the active user id', () => {
    setStoredUserId(42);
    expect(getStoredUserId()).toBe(42);
  });

  it('clears the cache when the user logs out', () => {
    setStoredUserId(7);
    setStoredUserId(null);
    expect(getStoredUserId()).toBe(null);
  });
});
